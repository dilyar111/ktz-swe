import React, { useState } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';
import { PublicFooter, PublicHeader } from '@/components/public/PublicChrome';

export default function Login() {
  const { login, user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    typeof location.state?.from === 'string' && location.state.from.startsWith('/')
      ? location.state.from
      : '/cockpit';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (user) {
    return <Navigate to={from} replace />;
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const result = login(username, password);
    if (result.ok) {
      navigate(from, { replace: true });
    } else {
      setError(result.errorKey ? t(result.errorKey) : result.error || t('public.loginError'));
    }
  }

  return (
    <div className="ktz-public min-h-screen bg-background text-foreground flex flex-col">
      <PublicHeader
        right={
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ktz-blue/50 rounded px-1"
          >
            {t('public.backHome')}
          </Link>
        }
      />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('public.loginTitle')}</h1>
            <p className="text-sm text-muted-foreground">{t('public.loginSubtitle')}</p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-4"
            noValidate
          >
            {error ? (
              <div
                className="rounded-md border border-red-700/25 bg-red-50 px-3 py-2 text-sm text-red-900"
                role="alert"
                aria-live="assertive"
              >
                {error}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label htmlFor="login-user" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('public.loginUser')}
              </label>
              <input
                id="login-user"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={cn(
                  'w-full h-11 px-3 rounded-md border border-border bg-background text-sm text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ktz-blue/55 focus-visible:border-ktz-blue/40'
                )}
                placeholder={t('public.loginUserPlaceholder')}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-pass" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('public.loginPass')}
              </label>
              <input
                id="login-pass"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(
                  'w-full h-11 px-3 rounded-md border border-border bg-background text-sm text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ktz-blue/55 focus-visible:border-ktz-blue/40'
                )}
                placeholder={t('public.loginPassPlaceholder')}
              />
            </div>

            <button type="submit" className="ktz-btn-primary w-full h-11 text-sm font-semibold flex items-center justify-center gap-2">
              <LogIn className="w-4 h-4" aria-hidden />
              {t('public.loginSubmit')}
            </button>
          </form>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
