import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Cockpit from './pages/Cockpit';
import IncidentCenter from './pages/IncidentCenter';
import Replay from './pages/Replay';
import Report from './pages/Report';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Cockpit />} />
          <Route path="alerts" element={<IncidentCenter />} />
          <Route path="history" element={<Replay />} />
          <Route path="report" element={<Report />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
