import React from 'react';
import { Link } from 'react-router-dom';
import KtzLogo from '@/components/KtzLogo';
import { useI18n } from '@/i18n/I18nContext';

/**
 * Shared header for landing / login — corporate left-aligned brand block (HK-037).
 */
export function PublicHeader({ right }) {
  const { t } = useI18n();
  return (
    <header className="border-b border-border bg-card/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 md:h-[4.25rem] flex items-center justify-between gap-4">
        <Link
          to="/"
          className="flex items-center gap-3 min-w-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ktz-blue/50 focus-visible:ring-offset-2 rounded-lg"
        >
          <div className="shrink-0 rounded-lg border border-ktz-blue/20 bg-white p-1 shadow-sm ring-1 ring-black/[0.04]">
            <KtzLogo size="sm" className="rounded-md" alt="" />
          </div>
          <div className="min-w-0 text-left">
            <span className="block text-[10px] uppercase tracking-[0.16em] text-ktz-blue font-semibold leading-tight">
              {t('public.brandShort')}
            </span>
            <span className="block text-sm sm:text-base font-bold tracking-tight text-foreground truncate">
              {t('public.brandTwin')}
            </span>
            <span className="hidden sm:block text-[11px] text-muted-foreground leading-snug truncate">
              {t('public.brandTagline')}
            </span>
          </div>
        </Link>
        {right ? <div className="shrink-0 flex items-center gap-2">{right}</div> : null}
      </div>
    </header>
  );
}

const FOOTER_LINKS = [
  { key: 'link1', href: '#' },
  { key: 'link2', href: '#' },
  { key: 'link3', href: '#' },
];

export function PublicFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border bg-card/60 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-12">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          <div className="flex items-start gap-3 max-w-md">
            <div className="rounded-lg border border-ktz-blue/15 bg-white p-1 shadow-sm shrink-0">
              <KtzLogo size="xs" alt="" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t('public.footerBrandLine')}</p>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{t('public.footerCorporate')}</p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label={t('public.footerNavLabel')}>
            {FOOTER_LINKS.map((item) => (
              <a
                key={item.key}
                href={item.href}
                className="text-ktz-blue/90 hover:text-ktz-blue underline-offset-4 hover:underline transition-colors"
              >
                {t(`public.footerLinks.${item.key}`)}
              </a>
            ))}
          </nav>
        </div>
        <p className="mt-8 pt-6 border-t border-border text-center text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
          {t('public.footer')}
        </p>
      </div>
    </footer>
  );
}
