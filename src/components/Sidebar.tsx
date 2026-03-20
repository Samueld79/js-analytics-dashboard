import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandSignature } from './BrandSignature';
import {
  LayoutDashboard,
  Users,
  BarChart2,
  TrendingUp,
  ClipboardList,
  Bell,
  Calendar,
  Settings,
  ChevronRight,
  LockKeyhole,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  X,
} from 'lucide-react';
import { useAlerts } from '../hooks/useAlerts';
import { useAuth } from '../hooks/useAuth';
import { roleLabel } from '../lib/utils';

type NavItem = {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  badge?: boolean;
};

const INTERNAL_NAV: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients', icon: Users, label: 'Clientes' },
  { to: '/calendar', icon: Calendar, label: 'Calendario' },
  { to: '/metrics', icon: BarChart2, label: 'Métricas Ads' },
  { to: '/sales', icon: TrendingUp, label: 'Ventas' },
  { to: '/strategies', icon: ClipboardList, label: 'Estrategias' },
  { to: '/alerts', icon: Bell, label: 'Alertas', badge: true },
];

const CLIENT_NAV: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/metrics', icon: BarChart2, label: 'Métricas Ads' },
  { to: '/sales', icon: TrendingUp, label: 'Ventas' },
  { to: '/strategies', icon: ClipboardList, label: 'Estrategias' },
  { to: '/mi-espacio', icon: LockKeyhole, label: 'Mi empresa' },
  { to: '/settings', icon: Settings, label: 'Configuración' },
];

export function Sidebar() {
  const loc = useLocation();
  const { unreadCount } = useAlerts();
  const { authEnabled, profile, role, isInternal, defaultClientId, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('sidebar:collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 768px)').matches;
  });

  const nav = isInternal
    ? INTERNAL_NAV
    : defaultClientId
      ? CLIENT_NAV
      : [];
  const sidebarCollapsed = collapsed && !isMobileViewport;
  const activeLabel = useMemo(() => {
    const activeEntry = nav.find(({ to }) => {
      if (to === '/') return loc.pathname === '/';
      if (to === '/mi-espacio') {
        return (
          loc.pathname === '/mi-espacio' ||
          (defaultClientId ? loc.pathname === `/clients/${defaultClientId}` : false)
        );
      }
      return loc.pathname.startsWith(to);
    });

    return activeEntry?.label ?? (isInternal ? 'Navegación' : 'Mi espacio');
  }, [defaultClientId, isInternal, loc.pathname, nav]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const media = window.matchMedia('(max-width: 768px)');
    const syncViewport = (matches: boolean) => {
      setIsMobileViewport(matches);
      if (!matches) {
        setMobileOpen(false);
      }
    };

    syncViewport(media.matches);
    const handleChange = (event: MediaQueryListEvent) => syncViewport(event.matches);
    media.addEventListener('change', handleChange);

    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    document.body.classList.toggle('mobile-nav-open', mobileOpen);

    return () => {
      document.body.classList.remove('mobile-nav-open');
    };
  }, [mobileOpen]);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('sidebar:collapsed', next ? '1' : '0');
        } catch {
          // Ignore persistence failures; the UI still works for the current session.
        }
      }
      return next;
    });
  }

  return (
    <>
      <button
        className="mobile-nav-trigger"
        onClick={() => setMobileOpen((current) => !current)}
        aria-label={mobileOpen ? 'Cerrar navegación' : 'Abrir navegación'}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        <div className="mobile-nav-copy">
          <BrandSignature
            compact
            subtitle={activeLabel}
            className="mobile-brand-signature"
          />
        </div>
      </button>
      <button
        className={`sidebar-backdrop ${mobileOpen ? 'visible' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden={!mobileOpen}
        tabIndex={mobileOpen ? 0 : -1}
      />
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <BrandSignature
            subtitle="AGENCIA / META ADS"
            className="sidebar-brand-signature"
          />
          <button
            className="sidebar-toggle"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
            aria-label={sidebarCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
          >
            {sidebarCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {nav.map(({ to, icon: Icon, label, badge }) => {
            const active =
              to === '/'
                ? loc.pathname === '/'
                : to === '/mi-espacio'
                  ? loc.pathname === '/mi-espacio' ||
                    (defaultClientId ? loc.pathname === `/clients/${defaultClientId}` : false)
                  : loc.pathname.startsWith(to);

            return (
              <Link
                key={to}
                to={to}
                className={`sidebar-link ${active ? 'active' : ''}`}
                title={sidebarCollapsed ? label : undefined}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={18} />
                <span className="sidebar-link-text">{label}</span>
                {badge && unreadCount > 0 && (
                  <span className="sidebar-badge">{unreadCount}</span>
                )}
                {active && !sidebarCollapsed && <ChevronRight size={14} className="sidebar-chevron" />}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {authEnabled && (
            <div className="sidebar-user-card">
              <div className="sidebar-user-avatar">
                {((profile?.full_name ?? profile?.email ?? 'U')[0] ?? 'U').toUpperCase()}
              </div>
              <div className="sidebar-user-copy">
                <div className="sidebar-user-name">
                  {profile?.email ?? profile?.full_name ?? 'Sesion activa'}
                </div>
                <div className="sidebar-user-role">{roleLabel(role)}</div>
              </div>
              <button className="sidebar-signout" onClick={() => void signOut()} title="Cerrar sesion">
                <LogOut size={14} />
              </button>
            </div>
          )}
          {isInternal && (
            <Link
              to="/settings"
              className="sidebar-link small"
              title={sidebarCollapsed ? 'Configuración' : undefined}
              onClick={() => setMobileOpen(false)}
            >
              <Settings size={14} />
              <span className="sidebar-link-text">Configuración</span>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
