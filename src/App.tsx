import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { ClientsPage } from './pages/ClientsPage';
import { ClientDetailPage } from './pages/ClientDetailPage';
import { MetricsPage } from './pages/MetricsPage';
import { SalesPage } from './pages/SalesPage';
import { StrategiesPage } from './pages/StrategiesPage';
import { AIAgentPage } from './pages/AIAgentPage';
import { AlertsPage } from './pages/AlertsPage';
import { isSupabaseConfigured } from './lib/supabase';

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <div className="page-bg" />
        <Sidebar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/clients/:id" element={<ClientDetailPage />} />
            <Route path="/metrics" element={<MetricsPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/strategies" element={<StrategiesPage />} />
            <Route path="/ai" element={<AIAgentPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<DashboardPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function SettingsPage() {
  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="page-subtitle">Sistema y preferencias</p>
        </div>
      </div>
      <div className="card section-block" style={{ maxWidth: 640, padding: '24px' }}>
        <div className="section-heading"><h2>Conexión Supabase</h2></div>
        <p style={{ color: '#a9b6cf', fontSize: '0.88rem' }}>
          El sistema opera sobre Supabase. Si no está configurado, las vistas cargarán vacías.
        </p>
        <ol style={{ color: '#c8d5ef', fontSize: '0.88rem', lineHeight: 1.8 }}>
          <li>Crea un proyecto en <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: '#7ab1ff' }}>supabase.com</a></li>
          <li>Corre el schema en <code>/supabase/schema.sql</code></li>
          <li>Opcional: vuelve a aplicar <code>/supabase/phase-1-operating-views.sql</code> si ajustas las vistas</li>
          <li>Crea el archivo <code>.env</code> basado en <code>.env.example</code></li>
          <li>Recarga el sistema</li>
        </ol>
        <div className="setting-item">
          <div className="setting-label">Modo de datos</div>
          <div className="setting-value" style={{ color: isSupabaseConfigured ? '#00e676' : '#ffc107' }}>
            {isSupabaseConfigured ? 'Supabase configurado' : 'Supabase no configurado'}
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-label">Versión</div>
          <div className="setting-value">Agency OS v1.1 · Fase 1</div>
        </div>
      </div>
    </div>
  );
}

export default App;
