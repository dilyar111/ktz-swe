import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Cockpit from './pages/Cockpit';
import Replay from './pages/Replay';

function Placeholder({ title }) {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Заготовка маршрута. Реализация в следующих ветках: feature/HK-007-replay,
          feature/HK-008-report-export.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Cockpit />} />
          <Route path="alerts" element={<Placeholder title="Incident Center" />} />
          <Route path="history" element={<Replay />} />
          <Route path="report" element={<Placeholder title="Export Report" />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
