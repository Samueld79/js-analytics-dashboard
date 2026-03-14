import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { isSupabaseConfigured } from './lib/supabase';
import { roleLabel } from './lib/utils';
import { LoginPage } from './pages/LoginPage';
import { AIAgentPage } from './pages/AIAgentPage';
import { AlertsPage } from './pages/AlertsPage';
import { ClientDetailPage } from './pages/ClientDetailPage';
import { ClientsPage } from './pages/ClientsPage';
import { DashboardPage } from './pages/DashboardPage';
import { MetricsPage } from './pages/MetricsPage';
import { SalesPage } from './pages/SalesPage';
import { StrategiesPage } from './pages/StrategiesPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

function AppContent() {
  const { authEnabled, initialized, session } = useAuth();

  if (authEnabled && !initialized) {
    return (
      <div className="auth-shell">
        <div className="page-bg" />
        <div className="auth-card card section-block">
          <h1 className="page-title">Agency OS</h1>
          <p className="page-subtitle">Validando sesion y permisos...</p>
        </div>
      </div>
    );
  }

  if (authEnabled && !session) {
    return <LoginPage />;
  }

  return (
    <div className="app-shell">
      <div className="page-bg" />
      <Sidebar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<RoleAwareHome />} />
          <Route path="/mi-espacio" element={<ClientWorkspaceEntry />} />
          <Route path="/clients" element={<RequireInternal><ClientsPage /></RequireInternal>} />
          <Route path="/clients/:id" element={<RequireClientAccess><ClientDetailPage /></RequireClientAccess>} />
          <Route path="/metrics" element={<RequireInternal><MetricsPage /></RequireInternal>} />
          <Route path="/sales" element={<RequireInternal><SalesPage /></RequireInternal>} />
          <Route path="/strategies" element={<RequireInternal><StrategiesPage /></RequireInternal>} />
          <Route path="/ai" element={<RequireInternal><AIAgentPage /></RequireInternal>} />
          <Route path="/alerts" element={<RequireInternal><AlertsPage /></RequireInternal>} />
          <Route path="/settings" element={<RequireInternal><SettingsPage /></RequireInternal>} />
          <Route path="*" element={<RoleAwareFallback />} />
        </Routes>
      </main>
    </div>
  );
}

function RoleAwareHome() {
  const { isInternal, clientWorkspacePath } = useAuth();

  if (isInternal || !isSupabaseConfigured) {
    return <DashboardPage />;
  }

  return <Navigate to={clientWorkspacePath} replace />;
}

function RoleAwareFallback() {
  const { isInternal, clientWorkspacePath } = useAuth();

  if (isInternal || !isSupabaseConfigured) {
    return <Navigate to="/" replace />;
  }

  return <Navigate to={clientWorkspacePath} replace />;
}

function ClientWorkspaceEntry() {
  const { isInternal, defaultClientId } = useAuth();

  if (isInternal || !isSupabaseConfigured) {
    return <Navigate to="/" replace />;
  }

  if (defaultClientId) {
    return <Navigate to={`/clients/${defaultClientId}`} replace />;
  }

  return <AccessDeniedPage title="Sin empresa asignada" body="Tu usuario cliente no tiene una empresa activa asociada." />;
}

function RequireInternal({ children }: { children: ReactNode }) {
  const { isInternal, clientWorkspacePath } = useAuth();

  if (isInternal || !isSupabaseConfigured) {
    return <>{children}</>;
  }

  return <Navigate to={clientWorkspacePath} replace />;
}

function RequireClientAccess({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const { isInternal, canAccessClient, clientWorkspacePath } = useAuth();

  if (isInternal || !isSupabaseConfigured) {
    return <>{children}</>;
  }

  if (canAccessClient(id)) {
    return <>{children}</>;
  }

  return <Navigate to={clientWorkspacePath} replace />;
}

function AccessDeniedPage({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="page-content">
      <div className="empty-state">
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </div>
  );
}

function SettingsPage() {
  const { authEnabled, profile, role, memberships, accessibleClientIds } = useAuth();

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="page-subtitle">Sistema, acceso y preferencias</p>
        </div>
      </div>
      <div className="card section-block" style={{ maxWidth: 700, padding: '24px' }}>
        <div className="section-heading"><h2>Conexión Supabase</h2></div>
        <p style={{ color: '#a9b6cf', fontSize: '0.88rem' }}>
          El sistema opera sobre Supabase. Si no está configurado, las vistas cargarán vacías.
        </p>
        <ol style={{ color: '#c8d5ef', fontSize: '0.88rem', lineHeight: 1.8 }}>
          <li>Crea un proyecto en <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: '#7ab1ff' }}>supabase.com</a></li>
          <li>Corre el schema en <code>/supabase/schema.sql</code></li>
          <li>Aplica las vistas de <code>/supabase/phase-1-operating-views.sql</code> si las ajustas</li>
          <li>Configura <code>.env</code> con <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code></li>
          <li>Crea usuarios en Supabase Auth y asigna perfil/rol</li>
        </ol>
        <div className="setting-item">
          <div className="setting-label">Modo de datos</div>
          <div className="setting-value" style={{ color: isSupabaseConfigured ? '#00e676' : '#ffc107' }}>
            {isSupabaseConfigured ? 'Supabase configurado' : 'Supabase no configurado'}
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-label">Autenticación</div>
          <div className="setting-value">{authEnabled ? 'Supabase Auth activo' : 'Desactivada por entorno local'}</div>
        </div>
        <div className="setting-item">
          <div className="setting-label">Usuario actual</div>
          <div className="setting-value">
            {profile?.full_name ?? profile?.email ?? 'Sesion local sin usuario'}
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-label">Rol</div>
          <div className="setting-value">{roleLabel(role)}</div>
        </div>
        <div className="setting-item">
          <div className="setting-label">Clientes accesibles</div>
          <div className="setting-value">
            {accessibleClientIds.length > 0 ? accessibleClientIds.length : 'Acceso interno total o sin asignaciones'}
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-label">Membresías activas</div>
          <div className="setting-value">{memberships.filter((membership) => membership.status === 'active').length}</div>
        </div>
        <div className="setting-item">
          <div className="setting-label">Versión</div>
          <div className="setting-value">Agency OS v1.6 · Internal Dashboard + Client Workspace</div>
        </div>
      </div>
    </div>
  );
}

export default App;
