import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import ru from './locales/ru';
import en from './locales/en';

const STORAGE_KEY = 'ktz_locale';

export const supportedLocales = ['ru', 'en'];

const LOCALES = { ru, en };

function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

/**
 * Safe locale from localStorage: only supported codes, else RU default.
 */
export function getSafeLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return supportedLocales.includes(stored) ? stored : 'ru';
  } catch {
    return 'ru';
  }
}

/**
 * @param {string} template
 * @param {Record<string, string | number> | undefined} vars
 */
function interpolate(template, vars) {
  if (!vars) return template;
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(String(v));
  }
  return out;
}

const I18nContext = createContext(
  /** @type {{ locale: string, setLocale: (l: string) => void, t: (key: string, vars?: Record<string, string | number>) => string } | null} */ (
    null
  )
);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => getSafeLocale());

  const setLocale = useCallback((next) => {
    const l = supportedLocales.includes(next) ? next : 'ru';
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key, vars) => {
      const dict = LOCALES[locale] || ru;
      let str = getByPath(dict, key) ?? getByPath(ru, key) ?? key;
      return interpolate(str, vars);
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}
