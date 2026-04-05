import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  AlertTriangle,
  History,
  FileText,
  Settings,
  Zap,
  LogOut,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ScenarioControl from '@/components/ScenarioControl';
import { useAuth } from '@/context/AuthContext';

const BASE_NAV = [
  { to: '/cockpit', label: 'Cockpit', icon: LayoutDashboard, end: true },
  { to: '/alerts', label: 'Incident Center', icon: AlertTriangle, end: false },
  { to: '/history', label: 'Replay & History', icon: History, end: false },
  { to: '/report', label: 'Reports', icon: FileText, end: false },
];

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_WS_URL || '';

/**
 * HK-032 — authenticated shell (operator + admin). Settings only for admin via /admin/settings.
 */
export function AppShell() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [locomotiveType, setLocomotiveType] = useState('KZ8A');

  useEffect(() => {
    fetch(`${API_BASE}/api/scenario`)
      .then((r) => r.json())
      .then((d) => {
        if (d && d.locomotiveType) setLocomotiveType(d.locomotiveType);
      })
      .catch(() => {});
  }, []);

  async function handleTypeChange(type) {
    setLocomotiveType(type);
    try {
      await fetch(`${API_BASE}/api/scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locomotiveType: type }),
      });
    } catch {
      /* ignore */
    }
  }

  function handleLogout() {
    logout();
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-16 border-b border-border bg-panel-elevated flex items-center justify-between px-4 lg:px-6 sticky top-0 z-50 gap-2">
        <div className="flex items-center gap-4 lg:gap-6 min-w-0 flex-1">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center border border-primary/50">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 hidden sm:block">
              <h1 className="text-sm font-bold leading-none tracking-tight truncate">
                KTZ Locomotive Digital Twin
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                Control Tower
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 border-l border-border pl-6 shrink-0">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Профиль:</span>
            <div className="flex bg-background rounded-md border border-border p-1">
              <button
                type="button"
                onClick={() => handleTypeChange('KZ8A')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-sm transition-colors',
                  locomotiveType === 'KZ8A'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                KZ8A
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('TE33A')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-sm transition-colors',
                  locomotiveType === 'TE33A'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                TE33A
              </button>
            </div>
          </div>

          <div className="hidden lg:flex items-center border-l border-border pl-6 min-w-0">
            <ScenarioControl />
          </div>
        </div>

        <nav className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          {BASE_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{item.label}</span>
            </NavLink>
          ))}

          {isAdmin ? (
            <NavLink
              to="/admin/settings"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-md text-sm font-medium transition-colors border border-transparent',
                  isActive
                    ? 'bg-primary/15 text-primary border-primary/30'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )
              }
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">Настройки</span>
            </NavLink>
          ) : null}

          <div className="w-px h-6 bg-border mx-1 hidden sm:block" />

          <div
            className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/40 border border-border/60 text-[10px] font-mono uppercase tracking-tighter text-muted-foreground max-w-[120px]"
            title="Роль в демо"
          >
            <Shield className="w-3 h-3 shrink-0 text-primary/80" />
            <span className="truncate">{user?.role ?? '—'}</span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
            title="Выйти"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </nav>
      </header>

      <main className="flex-1 overflow-auto bg-background p-4 lg:p-6">
        <Outlet context={{ locomotiveType }} />
      </main>
    </div>
  );
}
