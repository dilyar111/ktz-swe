import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

/**
 * HK-032 — public landing (no app chrome).
 */
export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/80 bg-panel-elevated/50">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-primary/15 flex items-center justify-center border border-primary/35">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">KTZ · Digital Twin</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center px-6 py-16">
        <div className="max-w-2xl mx-auto w-full space-y-8">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">
              Мониторинг подвижного состава
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight tracking-tight">
              Цифровой двигатель локомотива
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed max-w-xl">
              Телеметрия в реальном времени, индекс здоровья, алерты с рекомендациями и воспроизведение
              событий — единая панель для диспетчеров и инженеров KTZ.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center pt-2">
            {user ? (
              <Link
                to="/cockpit"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
              >
                Перейти в систему
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
              >
                Войти в систему
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            <p className="text-xs text-muted-foreground font-mono sm:pl-2">
              Демо-доступ: <span className="text-foreground">operator</span> / <span className="text-foreground">admin</span> · пароль{' '}
              <span className="text-foreground">demo</span>
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/60 py-6 px-6">
        <p className="max-w-4xl mx-auto text-center text-[11px] text-muted-foreground uppercase tracking-wider">
          Kazakhstan Temir Zholy — внутренний прототип
        </p>
      </footer>
    </div>
  );
}
