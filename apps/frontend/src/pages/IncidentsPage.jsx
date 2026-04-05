import React from 'react';
import { useI18n } from '@/i18n/I18nContext';

/** HK-034 — placeholder until Incident Center is implemented */
export default function IncidentsPage() {
  const { t } = useI18n();
  return (
    <div className="max-w-2xl mx-auto rounded-xl border border-border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('alertsPage.title')}</h1>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{t('alertsPage.stub')}</p>
    </div>
  );
}
