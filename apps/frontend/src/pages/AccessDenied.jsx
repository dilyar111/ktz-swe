import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';

/**
 * HK-032 — friendly page when a non-admin hits an admin-only route.
 */
export default function AccessDenied() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center space-y-4 py-12">
      <ShieldOff className="w-12 h-12 text-status-warning" aria-hidden />
      <h1 className="text-xl font-bold text-foreground">{t('accessDenied.title')}</h1>
      <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
        {t('accessDenied.body')}
      </p>
      <div className="flex flex-wrap gap-3 justify-center pt-2">
        <Link
          to="/cockpit"
          className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors min-h-[44px]"
        >
          {t('accessDenied.cockpit')}
        </Link>
        <Link
          to="/login"
          className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors min-h-[44px]"
        >
          {t('accessDenied.relogin')}
        </Link>
      </div>
    </div>
  );
}
