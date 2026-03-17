import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { BrandSignature } from './components/BrandSignature';
import { Sidebar } from './components/Sidebar';
import { useMetaSyncRows } from './hooks/useData';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { isSupabaseConfigured } from './lib/supabase';
import { formatDateTime, roleLabel } from './lib/utils';
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
  const location = useLocation();
  const isPortalRoute = location.pathname.startsWith('/portal/');

  if (authEnabled && !initialized) {
    return (
      <div className="auth-shell">
        <div className="page-bg" />
        <div className="auth-card card section-block">
          <BrandSignature
            subtitle="Validando acceso y contexto operativo..."
            className="auth-brand-signature"
          />
        </div>
      </div>
    );
  }

  if (authEnabled && !session) {
    return <LoginPage />;
  }

  const appRoutes = (
    <Routes>
      <Route path="/" element={<RoleAwareHome />} />
      <Route path="/mi-espacio" element={<ClientWorkspaceEntry />} />
      <Route path="/clients" element={<RequireInternal><ClientsPage /></RequireInternal>} />
      <Route path="/clients/:id" element={<RequireClientAccess><ClientDetailPage /></RequireClientAccess>} />
      <Route path="/portal/:id" element={<RequireClientAccess><ClientDetailPage /></RequireClientAccess>} />
      <Route path="/metrics" element={<RequireSignedIn><MetricsPage /></RequireSignedIn>} />
      <Route path="/sales" element={<RequireSignedIn><SalesPage /></RequireSignedIn>} />
      <Route path="/strategies" element={<RequireSignedIn><StrategiesPage /></RequireSignedIn>} />
      <Route path="/ai" element={<RequireInternal><AIAgentPage /></RequireInternal>} />
      <Route path="/alerts" element={<RequireInternal><AlertsPage /></RequireInternal>} />
      <Route path="/settings" element={<RequireSignedIn><SettingsPage /></RequireSignedIn>} />
      <Route path="*" element={<RoleAwareFallback />} />
    </Routes>
  );

  if (isPortalRoute) {
    return (
      <div className="portal-shell">
        <div className="page-bg" />
        <header className="portal-shell-header">
          <BrandSignature
            compact
            subtitle="Reporte cliente"
            className="portal-brand-signature"
          />
        </header>
        <main className="app-main portal-main">{appRoutes}</main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="page-bg" />
      <Sidebar />
      <main className="app-main">{appRoutes}</main>
    </div>
  );
}

function RoleAwareHome() {
  const { isInternal, defaultClientId } = useAuth();

  if (!isInternal && !defaultClientId) {
    return (
      <AccessDeniedPage
        title="Sin empresa asignada"
        body="Tu usuario cliente no tiene una empresa activa asociada."
      />
    );
  }

  return <DashboardPage />;
}

function RoleAwareFallback() {
  const { clientWorkspacePath } = useAuth();

  if (!isSupabaseConfigured) {
    return <Navigate to="/" replace />;
  }

  return <Navigate to={clientWorkspacePath === '/mi-espacio' ? '/' : clientWorkspacePath} replace />;
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
  const { isInternal } = useAuth();

  if (isInternal || !isSupabaseConfigured) {
    return <>{children}</>;
  }

  return <Navigate to="/" replace />;
}

function RequireSignedIn({ children }: { children: ReactNode }) {
  const { session } = useAuth();

  if (session || !isSupabaseConfigured) {
    return <>{children}</>;
  }

  return <Navigate to="/" replace />;
}

function RequireClientAccess({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { isInternal, canAccessClient, clientWorkspacePath, defaultClientId } = useAuth();

  if (isInternal || !isSupabaseConfigured) {
    return <>{children}</>;
  }

  if (canAccessClient(id)) {
    return <>{children}</>;
  }

  if (location.pathname.startsWith('/portal/') && defaultClientId) {
    return <Navigate to={`/portal/${defaultClientId}`} replace />;
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
  const { authEnabled, profile, role, memberships, accessibleClientIds, isInternal } = useAuth();
  const activeMemberships = memberships.filter((membership) => membership.status === 'active');
  const { syncRows } = useMetaSyncRows();
  const visibleSyncRows = isInternal
    ? syncRows
    : syncRows.filter((row) => accessibleClientIds.includes(row.client_id));
  const latestSyncAt = [...visibleSyncRows]
    .map((row) => row.last_sync_at)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="page-subtitle">Acceso, operación y estado del sistema</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="card section-block settings-card">
          <div className="section-heading">
            <h2>Cuenta actual</h2>
          </div>
          <p className="source-note">
            Estado del acceso actual y alcance operativo dentro del sistema.
          </p>
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
              {accessibleClientIds.length > 0
                ? accessibleClientIds.length
                : 'Acceso interno total o sin asignaciones'}
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-label">Membresías activas</div>
            <div className="setting-value">{activeMemberships.length}</div>
          </div>
        </section>

        <section className="card section-block settings-card">
          <div className="section-heading">
            <h2>Operación del sistema</h2>
          </div>
          <p className="source-note">
            Resumen claro de cómo opera hoy la plataforma para el equipo y el portal cliente.
          </p>
          <div className="period-chip-row">
            <span className="meta-chip">Meta Ads: sync diario</span>
            <span className="meta-chip">Ventas: carga manual</span>
            <span className="meta-chip">Portal cliente: por membresía</span>
          </div>
          <div className="setting-item">
            <div className="setting-label">Modo de datos</div>
            <div className="setting-value settings-status-value">
              {isSupabaseConfigured ? 'Supabase configurado' : 'Supabase no configurado'}
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-label">Autenticación</div>
            <div className="setting-value">
              {authEnabled ? 'Supabase Auth activo' : 'Desactivada por entorno local'}
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-label">Portal cliente</div>
            <div className="setting-value">
              Cada cliente ve solo sus empresas asignadas por membresía activa
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-label">Último sync Meta visible</div>
            <div className="setting-value">
              {latestSyncAt ? formatDateTime(latestSyncAt) : 'Sin sincronización registrada'}
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-label">Versión</div>
            <div className="setting-value">
              Growth Strategy JS · Dashboard interno y workspace cliente
            </div>
          </div>
        </section>
      </div>

    </div>
  );
}

export default App;
