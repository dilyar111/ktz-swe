import React, { useState } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Zap, LogIn } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

export default function Login() {
  const { login, user } = useAuth();
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
      setError(result.error || 'Ошибка входа');
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/80 bg-panel-elevated/50">
        <div className="max-w-md mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← На главную
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center border border-primary/35">
              <Zap className="w-4 h-4 text-primary" />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Вход</h1>
            <p className="text-sm text-muted-foreground">Демо-учётные записи: operator / admin, пароль demo</p>
          </div>

          <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
            {error ? (
              <div className="rounded-md border border-status-critical/40 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
                {error}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label htmlFor="login-user" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Логин
              </label>
              <input
                id="login-user"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={cn(
                  'w-full h-10 px-3 rounded-md border border-border bg-background text-sm',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary'
                )}
                placeholder="operator"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-pass" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Пароль
              </label>
              <input
                id="login-pass"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(
                  'w-full h-10 px-3 rounded-md border border-border bg-background text-sm',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary'
                )}
                placeholder="••••••"
              />
            </div>

            <button
              type="submit"
              className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Войти
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
