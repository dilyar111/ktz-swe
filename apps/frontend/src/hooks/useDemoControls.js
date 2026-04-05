import { useAuth } from '@/context/AuthContext';

/**
 * HK-034 — scenario selector and dev telemetry only when admin or when
 * VITE_DEMO_CONTROLS=true (explicit opt-in for hackathon demos).
 */
export function useDemoControls() {
  const { isAdmin } = useAuth();
  const isDemoEnv =
    String(import.meta.env.VITE_DEMO_CONTROLS).toLowerCase() === 'true';
  return isAdmin === true || isDemoEnv;
}
