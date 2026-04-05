import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nContext';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedLayout } from '@/components/ProtectedLayout';
import Cockpit from '@/pages/Cockpit';
import Replay from '@/pages/Replay';
import Report from '@/pages/Report';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import AccessDenied from '@/pages/AccessDenied';
import AdminSettings from '@/pages/AdminSettings';
import IncidentsPage from '@/pages/IncidentsPage';

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/access-denied" element={<AccessDenied />} />

            <Route element={<ProtectedLayout />}>
              <Route path="/cockpit" element={<Cockpit />} />
              <Route path="/alerts" element={<IncidentsPage />} />
              <Route path="/history" element={<Replay />} />
              <Route path="/report" element={<Report />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}
