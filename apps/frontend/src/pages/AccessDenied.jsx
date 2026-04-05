import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';

/**
 * HK-032 — friendly page when a non-admin hits an admin-only route.
 */
export default function AccessDenied() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center space-y-4">
      <ShieldOff className="w-12 h-12 text-status-warning" aria-hidden />
      <h1 className="text-xl font-bold">Доступ ограничен</h1>
      <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
        Этот раздел доступен только учётной записи с ролью <span className="font-mono text-foreground">admin</span>.
        Войдите под администратором или вернитесь к рабочим экранам.
      </p>
      <div className="flex flex-wrap gap-3 justify-center pt-2">
        <Link
          to="/cockpit"
          className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors"
        >
          Кокпит
        </Link>
        <Link
          to="/login"
          className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Сменить пользователя
        </Link>
      </div>
    </div>
  );
}
