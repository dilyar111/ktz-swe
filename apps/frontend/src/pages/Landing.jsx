import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nContext';

/**
 * HK-034 — public landing (light KTZ corporate shell).
 */
export default function Landing() {
  const { user } = useAuth();
  const { t } = useI18n();

  return (
    <div className="ktz-public min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-ktz-blue/90 to-ktz-blue flex items-center justify-center shadow-sm border border-ktz-blue/30">
            <Zap className="w-5 h-5 text-white" aria-hidden />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-tight text-foreground">{t('public.brandShort')}</span>
            <span className="text-muted-foreground text-sm"> · </span>
            <span className="text-sm font-medium text-muted-foreground">{t('public.brandTwin')}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center px-6 py-12 sm:py-20">
        <div className="max-w-2xl mx-auto w-full space-y-10">
          <div className="space-y-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-ktz-blue font-semibold">
              {t('public.landingKicker')}
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight tracking-tight">
              {t('public.landingTitle')}
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-xl">
              {t('public.landingBody')}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 sm:items-center pt-2">
            {user ? (
              <Link
                to="/cockpit"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-ktz-blue px-8 py-3.5 text-sm font-semibold text-white shadow-md hover:opacity-95 transition-opacity border border-ktz-blue/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ktz-gold focus-visible:ring-offset-2"
              >
                {t('public.ctaApp')}
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-ktz-blue px-8 py-3.5 text-sm font-semibold text-white shadow-md hover:opacity-95 transition-opacity border border-ktz-blue/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ktz-gold focus-visible:ring-offset-2"
              >
                {t('public.ctaLogin')}
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
            )}
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm border-l-2 border-ktz-gold/60 pl-4">
              {t('public.demoHint')}
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-8 px-6 bg-card/50">
        <p className="max-w-5xl mx-auto text-center text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
          {t('public.footer')}
        </p>
      </footer>
    </div>
  );
}
