import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCockpitData } from '@/hooks/useCockpitData';
import { MetricCards } from '@/components/cockpit/MetricCards';
import { DigitalTwin } from '@/components/cockpit/DigitalTwin';
import { cn } from '@/lib/utils';

function healthStrokeClass(status) {
  if (status === 'critical') return 'stroke-status-critical';
  if (status === 'warning') return 'stroke-status-warning';
  return 'stroke-status-ok';
}

export default function Cockpit() {
  const { locomotiveType } = useOutletContext();
  const { data, history, connected, profileMismatch, streamType } = useCockpitData(locomotiveType);

  const showLoading = connected && !lastMeaningfulData(data, profileMismatch);

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      {profileMismatch ? (
        <div className="rounded-lg border border-status-warning/40 bg-status-warning/10 px-4 py-3 text-sm text-foreground">
          <strong>Профиль не совпадает с потоком.</strong> Сейчас симулятор шлёт{' '}
          <span className="font-mono">{streamType}</span>, а в UI выбран{' '}
          <span className="font-mono">{locomotiveType}</span>. Запустите симулятор с{' '}
          <code className="rounded bg-muted px-1">LOCOMOTIVE_TYPE={locomotiveType}</code> или переключите
          профиль.
        </div>
      ) : null}

      {showLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[320px] gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground font-mono text-sm">
            {connected ? 'Ожидание телеметрии…' : 'Подключение к KTZ API…'}
          </p>
        </div>
      ) : null}

      {!showLoading && data ? (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{data.locomotive_id}</h2>
              <p className="text-muted-foreground font-mono text-sm">
                {connected ? 'ONLINE' : 'OFFLINE'} · тип {data.locomotiveType} · класс {data.healthClass}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-3">
              <div className="bg-card border border-border rounded-xl p-4 min-h-[400px]">
                <h3 className="font-semibold text-sm uppercase tracking-wider mb-4 opacity-70">Алерты</h3>
                {data.alerts.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    Нет активных алертов (правила на бэкенде — HK-следующий этап)
                  </div>
                ) : null}
              </div>
            </div>

            <div className="col-span-12 lg:col-span-6 space-y-4">
              <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center min-h-[400px]">
                <div className="relative w-64 h-64 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 256 256">
                    <circle
                      cx="128"
                      cy="128"
                      r="110"
                      className="stroke-border opacity-30"
                      strokeWidth="16"
                      fill="none"
                    />
                    <circle
                      cx="128"
                      cy="128"
                      r="110"
                      className={cn('transition-all duration-500 ease-out', healthStrokeClass(data.healthStatus))}
                      strokeWidth="16"
                      fill="none"
                      strokeDasharray="690"
                      strokeDashoffset={690 - (690 * data.health) / 100}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="text-center">
                    <span
                      className={cn(
                        'text-7xl font-sans font-bold',
                        data.healthStatus === 'critical'
                          ? 'text-status-critical'
                          : data.healthStatus === 'warning'
                            ? 'text-status-warning'
                            : 'text-status-ok'
                      )}
                    >
                      {data.health}
                    </span>
                    <p className="text-sm font-semibold tracking-widest uppercase opacity-50 mt-1">
                      Health Index
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">{data.healthStatus}</p>
                  </div>
                </div>

                {data.contributors?.length ? (
                  <div className="mt-6 w-full max-w-md">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                      Топ факторов
                    </p>
                    <ul className="space-y-1 text-sm font-mono">
                      {data.contributors.map((c) => (
                        <li key={c.key} className="flex justify-between border-b border-border/50 py-1 gap-2">
                          <span className="min-w-0" title={c.reason || undefined}>
                            {c.label}
                            {c.subsystem ? (
                              <span className="text-muted-foreground text-xs ml-1">({c.subsystem})</span>
                            ) : null}
                          </span>
                          <span className="text-status-warning shrink-0">+{c.penalty}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="col-span-12 lg:col-span-3">
              <div className="bg-card border border-border rounded-xl p-6 min-h-[400px]">
                <DigitalTwin metrics={data.metrics} locomotiveType={locomotiveType} />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <MetricCards
              metrics={data.metrics}
              history={history}
              locomotiveType={locomotiveType}
            />
          </div>
        </>
      ) : null}

      {!connected && !data ? (
        <div className="flex flex-col items-center justify-center min-h-[240px] gap-2 text-muted-foreground text-sm">
          <p>Нет соединения с WebSocket ({import.meta.env.VITE_WS_URL || 'http://localhost:5000'}).</p>
          <p>Запустите из корня: npm run dev</p>
        </div>
      ) : null}
    </div>
  );
}

function lastMeaningfulData(data, mismatch) {
  if (mismatch) return true;
  return Boolean(data);
}
