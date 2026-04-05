import React, { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { useDemoControls } from '@/hooks/useDemoControls';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_WS_URL || '';

const FALLBACK_VALID = [
  'normal',
  'warning_overheat',
  'critical',
  'highload',
  'brake_drop',
  'signal_loss',
];

function scenarioOptionLabel(t, id) {
  if (!id || typeof id !== 'string') return '';
  const fullKey = `cockpit.scenarios.${id}`;
  const resolved = t(fullKey);
  if (resolved === fullKey) return id.replace(/_/g, ' ');
  return resolved;
}

function ScenarioControlInner() {
  const { t } = useI18n();
  const [valid, setValid] = useState(FALLBACK_VALID);
  const [scenario, setScenario] = useState('normal');
  const [message, setMessage] = useState('');

  const pull = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/scenario`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.valid) && data.valid.length > 0) {
        setValid(data.valid);
      }
      if (typeof data.scenario === 'string') {
        setScenario(data.scenario);
      }
    } catch {
      /* simulator may be the only client; keep last state */
    }
  }, []);

  useEffect(() => {
    void pull();
    const id = setInterval(() => void pull(), 3500);
    return () => clearInterval(id);
  }, [pull]);

  async function onChange(e) {
    const next = e.target.value;
    setMessage('…');
    try {
      const res = await fetch(`${API_BASE}/api/scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setScenario(data.scenario);
        setMessage(t('scenario.applied'));
      } else {
        setMessage(data.error || t('scenario.error'));
      }
    } catch {
      setMessage(t('scenario.apiUnreachable'));
    }
    window.setTimeout(() => setMessage(''), 2800);
  }

  return (
    <div className="flex flex-col gap-1 min-w-[200px]">
      <div className="flex items-center gap-2">
        <label
          htmlFor="demo-scenario"
          className="text-xs text-muted-foreground uppercase tracking-wider whitespace-nowrap"
        >
          {t('scenario.label')}
        </label>
        <select
          id="demo-scenario"
          value={valid.includes(scenario) ? scenario : 'normal'}
          onChange={onChange}
          className="text-xs font-mono bg-background border border-border rounded-md px-2 py-1.5 max-w-[220px] text-foreground"
        >
          {valid.map((id) => (
            <option key={id} value={id}>
              {scenarioOptionLabel(t, id)}
            </option>
          ))}
        </select>
      </div>
      {message ? (
        <p className="text-[10px] text-muted-foreground font-mono truncate" aria-live="polite">
          {message}
        </p>
      ) : (
        <p className="text-[10px] text-muted-foreground/80 font-mono truncate" title={scenarioOptionLabel(t, scenario)}>
          {t('scenario.current')}:{' '}
          <span className="text-foreground">{scenarioOptionLabel(t, scenario)}</span>
        </p>
      )}
    </div>
  );
}

/** Demo scenario control — no network effects unless demo controls are enabled. */
export default function ScenarioControl() {
  const enabled = useDemoControls();
  if (!enabled) return null;
  return <ScenarioControlInner />;
}
