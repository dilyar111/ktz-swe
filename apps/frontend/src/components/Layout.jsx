import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, AlertTriangle, History, FileText, Settings, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import ScenarioControl from '@/components/ScenarioControl';
import SettingsModal from '@/components/SettingsModal';

const NAV_ITEMS = [
  { to: '/', label: 'Cockpit', icon: LayoutDashboard },
  { to: '/alerts', label: 'Incident Center', icon: AlertTriangle },
  { to: '/history', label: 'Replay & History', icon: History },
  { to: '/report', label: 'Reports', icon: FileText },
];

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_WS_URL || '';

export default function Layout() {
  const [locomotiveType, setLocomotiveType] = useState('KZ8A');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    // Initial fetch to sync with backend state
    fetch(`${API_BASE}/api/scenario`)
      .then(r => r.json())
      .then(d => {
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
    } catch {}
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-16 border-b border-border bg-panel-elevated flex items-center justify-between px-4 lg:px-6 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center border border-primary/50">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-none tracking-tight">KTZ Locomotive Digital Twin</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                Control Tower
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 border-l border-border pl-6">
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

          <div className="hidden lg:flex items-center border-l border-border pl-6">
            <ScenarioControl />
          </div>
        </div>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )
              }
            >
              <item.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </NavLink>
          ))}
          <div className="w-px h-6 bg-border mx-2" />
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
            title="Настройки"
          >
            <Settings className="w-4 h-4" />
          </button>
        </nav>
      </header>

      <main className="flex-1 overflow-auto bg-background p-4 lg:p-6">
        <Outlet context={{ locomotiveType }} />
      </main>

      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
}
