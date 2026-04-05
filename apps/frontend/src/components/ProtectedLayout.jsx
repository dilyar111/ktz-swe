import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/AppShell';

/**
 * HK-032 — requires authenticated session; wraps operator/admin shell.
 */
export function ProtectedLayout() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to="/login" state={{ from: returnTo }} replace />;
  }

  return <AppShell />;
}
