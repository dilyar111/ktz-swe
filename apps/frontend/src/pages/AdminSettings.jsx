import React from 'react';
import { Navigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import SystemSettingsForm from '@/components/settings/SystemSettingsForm';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nContext';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_WS_URL || 'http://localhost:5000';
const DOCS_URL = `${String(API_BASE).replace(/\/$/, '')}/docs`;

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
        <p className="text-xs text-muted-foreground mt-3 flex flex-wrap items-center gap-2">
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-primary font-medium hover:underline"
          >
            {t('admin.apiDocsLine')}
            <ExternalLink className="w-3.5 h-3.5" aria-hidden />
          </a>
          <span className="text-muted-foreground/90">— {t('admin.apiDocsHint')}</span>
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <SystemSettingsForm />
      </div>
    </div>
  );
}
