import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedLayout } from '@/components/ProtectedLayout';
import Cockpit from '@/pages/Cockpit';
import Replay from '@/pages/Replay';
import Report from '@/pages/Report';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import AccessDenied from '@/pages/AccessDenied';
import AdminSettings from '@/pages/AdminSettings';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/access-denied" element={<AccessDenied />} />

          <Route element={<ProtectedLayout />}>
            <Route path="/cockpit" element={<Cockpit />} />
            <Route
              path="/alerts"
              element={
                <div className="flex items-center justify-center min-h-[50vh] px-4">
                  <div className="text-center space-y-2 max-w-md">
                    <h1 className="text-xl font-bold text-foreground">Incident Center</h1>
                    <p className="text-sm text-muted-foreground">
                      Заготовка маршрута. Реализация в следующих ветках.
                    </p>
                  </div>
                </div>
              }
            />
            <Route path="/history" element={<Replay />} />
            <Route path="/report" element={<Report />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
