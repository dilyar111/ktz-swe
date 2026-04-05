import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nContext';

/** HK-019/034 — transport + data freshness */
const STYLES = {
  online: 'bg-status-ok/15 text-status-ok border-status-ok/40',
  stale: 'bg-status-warning/15 text-status-warning border-status-warning/45',
  reconnecting: 'bg-primary/15 text-primary border-primary/40',
  connecting: 'bg-muted text-muted-foreground border-border',
  offline: 'bg-status-critical/10 text-status-critical border-status-critical/40',
};

const STATUS_KEYS = {
  online: 'connection.online',
  stale: 'connection.stale',
  reconnecting: 'connection.reconnecting',
  connecting: 'connection.connecting',
  offline: 'connection.offline',
};

/**
 * @param {{
 *   status: 'online' | 'stale' | 'reconnecting' | 'connecting' | 'offline',
 *   className?: string,
 * }} props
 */
export default function ConnectionStatusBadge({ status, className }) {
  const { t } = useI18n();
  const key = STATUS_KEYS[status] ?? STATUS_KEYS.offline;
  const label = t(key);
  const pulse = status === 'online';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        STYLES[status] ?? STYLES.offline,
        className
      )}
      role="status"
      aria-live="polite"
    >
      {pulse ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      ) : status === 'reconnecting' || status === 'connecting' ? (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin opacity-90" aria-hidden />
      ) : null}
      {label}
    </span>
  );
}
