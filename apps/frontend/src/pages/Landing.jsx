import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, Gauge, History, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nContext';
import { PublicFooter, PublicHeader } from '@/components/public/PublicChrome';

const HERO_BG = '/branding/landing-hero.webp';

/**
 * HK-037 — corporate landing: hero, transport visual, value cards, KTZ relevance, shared public chrome.
 */
export default function Landing() {
  const { user } = useAuth();
  const { t } = useI18n();

  const valueSpecs = [
    { icon: Gauge, k: '1' },
    { icon: Bell, k: '2' },
    { icon: History, k: '3' },
    { icon: Shield, k: '4' },
  ];

  return (
    <div className="ktz-public min-h-screen bg-background text-foreground flex flex-col">
      <PublicHeader />

      <main className="flex-1 flex flex-col">
        <section className="relative overflow-hidden border-b border-border">
          <div
            className="absolute inset-0 bg-cover bg-center scale-105"
            style={{ backgroundImage: `url(${HERO_BG})` }}
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-br from-background via-background/92 to-ktz-blue/[0.18]"
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" aria-hidden />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 md:py-24">
            <div className="max-w-2xl space-y-6">
              <p className="text-[11px] uppercase tracking-[0.22em] text-ktz-blue font-semibold">
                {t('public.landingKicker')}
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-[2.35rem] font-bold text-foreground leading-[1.12] tracking-tight">
                {t('public.landingTitle')}
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
                {t('public.heroLead')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center pt-2">
                {user ? (
                  <Link
                    to="/cockpit"
                    className="ktz-btn-primary inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-semibold"
                  >
                    {t('public.ctaApp')}
                    <ArrowRight className="w-4 h-4" aria-hidden />
                  </Link>
                ) : (
                  <Link
                    to="/login"
                    className="ktz-btn-primary inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-semibold"
                  >
                    {t('public.ctaLogin')}
                    <ArrowRight className="w-4 h-4" aria-hidden />
                  </Link>
                )}
                <p className="text-xs text-muted-foreground leading-relaxed max-w-sm border-l-2 border-ktz-gold/70 pl-4">
                  {t('public.demoHint')}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 md:py-16 w-full">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {valueSpecs.map(({ icon: Icon, k }) => (
              <div
                key={k}
                className="rounded-xl border border-border bg-card p-5 shadow-sm hover:border-ktz-blue/25 hover:shadow-md transition-all"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-ktz-blue/10 text-ktz-blue border border-ktz-blue/15">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h2 className="text-sm font-semibold text-foreground leading-snug">
                  {t(`public.value${k}Title`)}
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {t(`public.value${k}Body`)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-gradient-to-br from-ktz-blue/[0.06] via-card/80 to-ktz-gold/[0.06]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16">
            <div className="max-w-3xl">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                {t('public.whyTitle')}
              </h2>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
                {t('public.whyBody')}
              </p>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
