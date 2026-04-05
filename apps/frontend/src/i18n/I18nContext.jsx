import React, { createContext, useCallback, useContext, useMemo } from 'react';
import ru from './locales/ru';

const STORAGE_KEY = 'ktz_locale';

/** Интерфейс только на русском (HK-040); латиница — обозначения типов KZ8A/TE33A и т.п. */
export const supportedLocales = ['ru'];

const LOCALES = { ru };

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
 * Всегда ru: единый язык для демо и прод-подобного показа.
 */
export function getSafeLocale() {
  try {
    localStorage.setItem(STORAGE_KEY, 'ru');
  } catch {
    /* ignore */
  }
  return 'ru';
}

function interpolate(template, vars) {
  if (!vars) return template;
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(String(v));
  }
  return out;
}

const I18nContext = createContext(
  /** @type {{ locale: 'ru', setLocale: (l: string) => void, t: (key: string, vars?: Record<string, string | number>) => string } | null} */ (
    null
  )
);

export function I18nProvider({ children }) {
  const t = useCallback((key, vars) => {
    let str = getByPath(LOCALES.ru, key) ?? key;
    return interpolate(str, vars);
  }, []);

  const setLocale = useCallback((next) => {
    if (next !== 'ru') {
      try {
        localStorage.setItem(STORAGE_KEY, 'ru');
      } catch {
        /* ignore */
      }
    }
  }, []);

  const value = useMemo(() => ({ locale: 'ru', setLocale, t }), [t, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}
