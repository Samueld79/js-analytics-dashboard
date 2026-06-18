import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { BrandSignature } from './components/BrandSignature';
import { Sidebar } from './components/Sidebar';
import { useMetaSyncRows } from './hooks/useData';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { isSupabaseConfigured } from './lib/supabase';
import { formatDateTime, roleLabel } from './lib/utils';
import { LoginPage } from './pages/LoginPage';
import { AlertsPage } from './pages/AlertsPage';
import { ClientDetailPage } from './pages/ClientDetailPage';
import { ClientsPage } from './pages/ClientsPage';
import { DashboardPage } from './pages/DashboardPage';
import { MetricsPage } from './pages/MetricsPage';
import { SalesPage } from './pages/SalesPage';
import { StrategiesPage } from './pages/StrategiesPage';
import { CalendarPage } from './pages/CalendarPage';
import { AIToolsPage } from './pages/ai-tools/AIToolsPage';
import { DashboardClientPage } from './pages/DashboardClientPage';
import { SplashScreen } from './components/SplashScreen';
import { WelcomeOverlay } from './components/WelcomeOverlay';

function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const handleVisibility = () => {
      document.body.classList.toggle('tab-hidden', document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

function AppContent() {
  const { authEnabled, initialized, session, profile } = useAuth();
  const location = useLocation();
  const isPortalRoute = location.pathname.startsWith('/portal/');
  const hadNullSession = useRef(false);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);

  // Track when app was initialised with no session (= login screen shown)
  useEffect(() => {
    if (initialized && !session) hadNullSession.current = true;
  }, [initialized, session]);

  // Detect fresh login: session appeared after we had a null-session cycle
  useEffect(() => {
    if (initialized && session && hadNullSession.current) {
      hadNullSession.current = false;
      const name = profile?.full_name ?? profile?.email ?? session.user.email ?? 'equipo';
      setWelcomeName(name);
    }
  }, [initialized, session, profile]);

  // Portal routes are fully public — skip the auth gate entirely
  if (!isPortalRoute) {
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
  }

  const appRoutes = (
    <Routes>
      <Route path="/" element={<RoleAwareHome />} />
      <Route path="/mi-espacio" element={<ClientWorkspaceEntry />} />
      <Route path="/clients" element={<RequireInternal><ClientsPage /></RequireInternal>} />
      <Route path="/clients/:id" element={<RequireClientAccess><ClientDetailPage /></RequireClientAccess>} />
      <Route path="/dashboard/cliente/:clientId" element={<RequireInternal><DashboardClientPage /></RequireInternal>} />
      <Route path="/portal/:id" element={<ClientDetailPage />} />
      <Route path="/metrics" element={<RequireSignedIn><MetricsPage /></RequireSignedIn>} />
      <Route path="/sales" element={<RequireSignedIn><SalesPage /></RequireSignedIn>} />
      <Route path="/strategies" element={<RequireSignedIn><StrategiesPage /></RequireSignedIn>} />
      <Route path="/calendar" element={<RequireInternal><CalendarPage /></RequireInternal>} />
      <Route path="/alerts" element={<RequireInternal><AlertsPage /></RequireInternal>} />
      <Route path="/ai-tools/*" element={<RequireInternal><AIToolsPage /></RequireInternal>} />
      <Route path="/settings" element={<RequireSignedIn><SettingsPage /></RequireSignedIn>} />
      <Route path="*" element={<RoleAwareFallback />} />
    </Routes>
  );

  if (isPortalRoute) {
    return (
      <>
        {welcomeName && <WelcomeOverlay name={welcomeName} onDone={() => setWelcomeName(null)} />}
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
      </>
    );
  }

  return (
    <>
      {welcomeName && <WelcomeOverlay name={welcomeName} onDone={() => setWelcomeName(null)} />}
      <div className="app-shell">
        <div className="page-bg" />
        <Sidebar />
        <main className="app-main">{appRoutes}</main>
      </div>
    </>
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

const SETTINGS_ITEM: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 0',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  gap: 12,
};

const SETTINGS_LABEL: CSSProperties = {
  fontSize: '0.74rem',
  color: 'hsl(215,15%,48%)',
  flexShrink: 0,
};

const SETTINGS_VALUE: CSSProperties = {
  fontSize: '0.8rem',
  color: 'hsl(215,15%,82%)',
  textAlign: 'right' as const,
  fontFamily: 'JetBrains Mono, monospace',
};

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{
      padding: '2px 9px', borderRadius: 20, fontSize: '0.66rem', fontWeight: 700,
      background: ok ? 'hsl(145 100% 45% / 0.12)' : 'hsl(215 15% 38% / 0.15)',
      color: ok ? 'hsl(145,100%,55%)' : 'hsl(215,15%,52%)',
      border: `1px solid ${ok ? 'hsl(145 100% 45% / 0.2)' : 'rgba(255,255,255,0.07)'}`,
    }}>
      {ok ? '● ' : '○ '}{label}
    </span>
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

  const displayName = profile?.full_name ?? profile?.email ?? null;
  const initial = (displayName ?? 'U')[0]?.toUpperCase() ?? 'U';

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="page-subtitle" style={{ letterSpacing: '0.06em', fontSize: '0.72rem' }}>
            ACCESO · OPERACIÓN · ESTADO
          </p>
        </div>
      </div>

      <div className="settings-grid">
        {/* ── Card 1: Cuenta ── */}
        <section style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: '20px 22px',
        }}>
          {/* Avatar + name */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
            <div style={{
              width: 46, height: 46, borderRadius: '50%',
              background: 'hsl(180 100% 50% / 0.15)',
              border: '2px solid hsl(180 100% 50% / 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', fontWeight: 700, color: 'hsl(180,100%,60%)',
              flexShrink: 0,
            }}>
              {initial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(215,15%,88%)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName ?? 'Sesión local'}
              </div>
              <StatusBadge ok label={roleLabel(role)} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={SETTINGS_ITEM}>
              <span style={SETTINGS_LABEL}>Clientes</span>
              <span style={SETTINGS_VALUE}>
                {accessibleClientIds.length > 0 ? `${accessibleClientIds.length} asignados` : 'Acceso total'}
              </span>
            </div>
            <div style={SETTINGS_ITEM}>
              <span style={SETTINGS_LABEL}>Membresías activas</span>
              <span style={{ ...SETTINGS_VALUE, color: activeMemberships.length > 0 ? 'hsl(145,100%,55%)' : 'hsl(215,15%,48%)' }}>
                {activeMemberships.length}
              </span>
            </div>
            <div style={{ ...SETTINGS_ITEM, borderBottom: 'none' }}>
              <span style={SETTINGS_LABEL}>Portal</span>
              <span style={SETTINGS_VALUE} >Membresía activa</span>
            </div>
          </div>
        </section>

        {/* ── Card 2: Sistema ── */}
        <section style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: '20px 22px',
        }}>
          <p className="number-label" style={{ fontSize: '0.6rem', marginBottom: 16, color: 'hsl(180,100%,50%)', letterSpacing: '0.12em' }}>
            SISTEMA
          </p>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            <StatusBadge ok={isSupabaseConfigured} label={isSupabaseConfigured ? 'Supabase' : 'Sin Supabase'} />
            <StatusBadge ok={authEnabled} label={authEnabled ? 'Auth activo' : 'Auth local'} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={SETTINGS_ITEM}>
              <span style={SETTINGS_LABEL}>Meta Ads</span>
              <span style={{ ...SETTINGS_VALUE, color: 'hsl(180,100%,55%)' }}>Sync diario</span>
            </div>
            <div style={SETTINGS_ITEM}>
              <span style={SETTINGS_LABEL}>Ventas</span>
              <span style={SETTINGS_VALUE}>Carga manual</span>
            </div>
            <div style={SETTINGS_ITEM}>
              <span style={SETTINGS_LABEL}>Último sync Meta</span>
              <span style={{ ...SETTINGS_VALUE, fontSize: '0.72rem' }}>
                {latestSyncAt ? formatDateTime(latestSyncAt) : '—'}
              </span>
            </div>
            <div style={{ ...SETTINGS_ITEM, borderBottom: 'none' }}>
              <span style={SETTINGS_LABEL}>Versión</span>
              <span style={{ ...SETTINGS_VALUE, color: 'hsl(215,15%,42%)', fontSize: '0.7rem' }}>
                Growth Strategy
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
