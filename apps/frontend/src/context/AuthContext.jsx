import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'ktz_demo_auth';

/** Demo-only accounts — hackathon / local; not for production. */
export const DEMO_ACCOUNTS = Object.freeze({
  operator: { password: 'demo', role: 'operator', label: 'Operator' },
  admin: { password: 'demo', role: 'admin', label: 'Administrator' },
});

/**
 * @typedef {{ username: string, role: 'operator' | 'admin', label?: string }} AuthUser
 */

function readStoredUser() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.username !== 'string' || !parsed.role) return null;
    if (parsed.role !== 'operator' && parsed.role !== 'admin') return null;
    return parsed;
  } catch {
    return null;
  }
}

const AuthContext = createContext(
  /** @type {{ user: AuthUser | null, login: (u: string, p: string) => { ok: boolean, error?: string }, logout: () => void, isAdmin: boolean } | null} */ (
    null
  )
);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(/** @type {AuthUser | null} */ (readStoredUser));

  const login = useCallback((username, password) => {
    const key = String(username || '')
      .trim()
      .toLowerCase();
    const account = DEMO_ACCOUNTS[key];
    if (!account || account.password !== password) {
      return { ok: false, error: 'Неверный логин или пароль' };
    }
    const next = {
      username: key,
      role: account.role,
      label: account.label,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setUser(next);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      isAdmin: user?.role === 'admin',
    }),
    [user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
