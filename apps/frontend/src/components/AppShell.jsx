import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
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
import { useI18n } from '@/i18n/I18nContext';
import { useDemoControls } from '@/hooks/useDemoControls';

const NAV_CONFIG = [
  { to: '/cockpit', labelKey: 'shell.nav.cockpit', icon: LayoutDashboard, end: true },
  { to: '/alerts', labelKey: 'shell.nav.alerts', icon: AlertTriangle, end: false },
  { to: '/history', labelKey: 'shell.nav.history', icon: History, end: false },
  { to: '/report', labelKey: 'shell.nav.report', icon: FileText, end: false },
];

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_WS_URL || '';
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5000';

/**
 * HK-032/034 — authenticated operational shell (dark). Demo scenario only for admin / demo flag.
 */
export function AppShell() {
  const { user, logout, isAdmin } = useAuth();
  const { t } = useI18n();
  const showDemoControls = useDemoControls();
  const navigate = useNavigate();
  const [locomotiveType, setLocomotiveType] = useState('KZ8A');
  const [criticalCount, setCriticalCount] = useState(0);

  const navItems = useMemo(
    () =>
      NAV_CONFIG.map((item) => ({
        ...item,
        label: t(item.labelKey),
      })),
    [t]
  );

  useEffect(() => {
    fetch(`${API_BASE}/api/scenario`)
      .then((r) => r.json())
      .then((d) => {
        if (d && d.locomotiveType) setLocomotiveType(d.locomotiveType);
      })
      .catch(() => {});
  }, []);

  // Live critical alert badge via WebSocket
  useEffect(() => {
    const socket = io(WS_URL, { transports: ['websocket'], autoConnect: true });
    socket.on('alerts:update', (payload) => {
      const crits = (payload?.alerts ?? []).filter(
        (a) => !a.acked && a.severity === 'critical'
      );
      setCriticalCount(crits.length);
    });
    // Also poll once on mount
    fetch(`${API_BASE}/api/alerts`)
      .then((r) => r.json())
      .then((d) => {
        const crits = (d?.alerts ?? []).filter((a) => !a.acked && a.severity === 'critical');
        setCriticalCount(crits.length);
      })
      .catch(() => {});
    return () => {
      socket.removeAllListeners();
      socket.close();
    };
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
      <header className="min-h-16 border-b border-border bg-panel-elevated flex flex-wrap items-center justify-between gap-y-2 px-4 lg:px-6 py-2 sticky top-0 z-50">
        <div className="flex items-center gap-4 lg:gap-6 min-w-0 flex-1">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center border border-primary/40">
              <Zap className="w-5 h-5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0 hidden sm:block">
              <h1 className="text-sm font-bold leading-none tracking-tight truncate text-foreground">
                {t('shell.productTitle')}
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                {t('shell.productSubtitle')}
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 border-l border-border pl-6 shrink-0">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">{t('shell.profile')}</span>
            <div className="flex bg-background rounded-md border border-border p-1" role="group" aria-label={t('shell.profile')}>
              <button
                type="button"
                onClick={() => handleTypeChange('KZ8A')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-sm transition-colors min-h-[44px] sm:min-h-0',
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
                  'px-3 py-1 text-xs font-medium rounded-sm transition-colors min-h-[44px] sm:min-h-0',
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

        <nav className="flex items-center gap-0.5 sm:gap-1 shrink-0" aria-label={t('shell.navMain')}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] sm:min-h-0',
                  isActive
                    ? 'bg-primary/12 text-primary border border-primary/25'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent'
                )
              }
            >
              <item.icon className="w-4 h-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">{item.label}</span>
              {/* Live critical badge on Incident Center nav */}
              {item.to === '/alerts' && criticalCount > 0 && (
                <span
                  className="ml-0.5 min-w-[18px] h-[18px] rounded-full bg-status-critical text-white text-[10px] font-bold flex items-center justify-center leading-none px-1 animate-pulse"
                  title={`${criticalCount} критических инцидентов`}
                >
                  {criticalCount > 9 ? '9+' : criticalCount}
                </span>
              )}
            </NavLink>
          ))}

          {isAdmin ? (
            <NavLink
              to="/admin/settings"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-md text-sm font-medium transition-colors border min-h-[44px] sm:min-h-0',
                  isActive
                    ? 'bg-ktz-gold/10 text-ktz-gold border-ktz-gold/35'
                    : 'border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground'
                )
              }
            >
              <Settings className="w-4 h-4 shrink-0" aria-hidden />
              <span className="hidden md:inline">{t('shell.nav.settings')}</span>
            </NavLink>
          ) : null}

          <div className="w-px h-6 bg-border mx-1 hidden sm:block" aria-hidden />

          {showDemoControls ? (
            <div
              className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/40 border border-border/60 text-[10px] font-mono uppercase tracking-tighter text-muted-foreground max-w-[120px]"
              title={t('shell.roleHint')}
            >
              <Shield className="w-3 h-3 shrink-0 text-primary/80" aria-hidden />
              <span className="truncate">{user?.role ?? '—'}</span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleLogout}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            title={t('shell.logout')}
            aria-label={t('shell.logout')}
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
