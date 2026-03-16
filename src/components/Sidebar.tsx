import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  BarChart2,
  TrendingUp,
  ClipboardList,
  Bot,
  Bell,
  Settings,
  ChevronRight,
  LockKeyhole,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useAlerts } from '../hooks/useAlerts';
import { useAuth } from '../hooks/useAuth';
import { roleLabel } from '../lib/utils';

const INTERNAL_NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients', icon: Users, label: 'Clientes' },
  { to: '/metrics', icon: BarChart2, label: 'Métricas Ads' },
  { to: '/sales', icon: TrendingUp, label: 'Ventas' },
  { to: '/strategies', icon: ClipboardList, label: 'Estrategias' },
  { to: '/ai', icon: Bot, label: 'Agente IA' },
  { to: '/alerts', icon: Bell, label: 'Alertas', badge: true },
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

  const nav = isInternal
    ? INTERNAL_NAV
    : defaultClientId
      ? [{ to: '/mi-espacio', icon: LockKeyhole, label: 'Mi espacio' }]
      : [];

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
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <TrendingUp size={18} />
        </div>
        <div className="sidebar-brand-copy">
          <span className="sidebar-brand-name">Growth Strategy JS</span>
          <span className="sidebar-brand-sub">
            {isInternal ? 'Panel de crecimiento' : 'Workspace privado'}
          </span>
        </div>
        <button
          className="sidebar-toggle"
          onClick={toggleSidebar}
          title={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
          aria-label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navegación</div>
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
              title={collapsed ? label : undefined}
            >
              <Icon size={16} />
              <span className="sidebar-link-text">{label}</span>
              {badge && unreadCount > 0 && (
                <span className="sidebar-badge">{unreadCount}</span>
              )}
              {active && !collapsed && <ChevronRight size={14} className="sidebar-chevron" />}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {authEnabled && (
          <div className="sidebar-user-card">
            <div className="sidebar-user-copy">
              <div className="sidebar-user-name">
                {profile?.full_name ?? profile?.email ?? 'Sesion activa'}
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
            title={collapsed ? 'Configuración' : undefined}
          >
            <Settings size={14} />
            <span className="sidebar-link-text">Configuración</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
