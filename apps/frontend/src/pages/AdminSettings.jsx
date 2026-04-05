import React from 'react';
import { Navigate } from 'react-router-dom';
import SystemSettingsForm from '@/components/settings/SystemSettingsForm';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nContext';

/**
 * HK-032 — admin-only system settings (health weights, alert thresholds).
 */
export default function AdminSettings() {
  const { isAdmin } = useAuth();
  const { t } = useI18n();

  if (!isAdmin) {
    return <Navigate to="/access-denied" replace />;
  }

  return (
    <div className="max-w-[960px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('admin.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{t('admin.subtitle')}</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <SystemSettingsForm />
      </div>
    </div>
  );
}
