import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BarChart2, TrendingUp, ClipboardList,
  Bot, Bell, Settings, ChevronRight, Zap, LockKeyhole, LogOut
} from 'lucide-react';
import { useAlerts } from '../hooks/useAlerts';
import { useAuth } from '../hooks/useAuth';
import { useClients } from '../hooks/useClients';
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
  const { clients } = useClients();
  const { authEnabled, profile, role, isInternal, defaultClientId, signOut } = useAuth();

  const nav = isInternal
    ? INTERNAL_NAV
    : defaultClientId
      ? [{ to: '/mi-espacio', icon: LockKeyhole, label: 'Mi espacio' }]
      : [];
  const visibleClients = isInternal
    ? clients.slice(0, 6)
    : clients.filter((client) => client.id === defaultClientId).slice(0, 1);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <Zap size={18} />
        </div>
        <div>
          <span className="sidebar-brand-name">Agency OS</span>
          <span className="sidebar-brand-sub">{isInternal ? 'Panel Interno' : 'Workspace Cliente'}</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navegación</div>
        {nav.map(({ to, icon: Icon, label, badge }) => {
          const active =
            to === '/'
              ? loc.pathname === '/'
              : to === '/mi-espacio'
                ? loc.pathname === '/mi-espacio' || (defaultClientId ? loc.pathname === `/clients/${defaultClientId}` : false)
                : loc.pathname.startsWith(to);
          return (
            <Link key={to} to={to} className={`sidebar-link ${active ? 'active' : ''}`}>
              <Icon size={16} />
              <span>{label}</span>
              {badge && unreadCount > 0 && (
                <span className="sidebar-badge">{unreadCount}</span>
              )}
              {active && <ChevronRight size={14} className="sidebar-chevron" />}
            </Link>
          );
        })}
      </nav>

      {clients.length > 0 && (
        <div className="sidebar-clients">
          <div className="sidebar-section-label">{isInternal ? 'Clientes' : 'Tu empresa'}</div>
          {visibleClients.map(c => (
            <Link key={c.id} to={`/clients/${c.id}`} className={`sidebar-client-link ${loc.pathname === `/clients/${c.id}` ? 'active' : ''}`}>
              <span className="sidebar-client-dot" style={{ background: clientColor(c.id) }} />
              <span>{c.name}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="sidebar-footer">
        {authEnabled && (
          <div className="sidebar-user-card">
            <div>
              <div className="sidebar-user-name">{profile?.full_name ?? profile?.email ?? 'Sesion activa'}</div>
              <div className="sidebar-user-role">{roleLabel(role)}</div>
            </div>
            <button className="sidebar-signout" onClick={() => void signOut()} title="Cerrar sesion">
              <LogOut size={14} />
            </button>
          </div>
        )}
        {isInternal && (
          <Link to="/settings" className="sidebar-link small">
            <Settings size={14} />
            <span>Configuración</span>
          </Link>
        )}
      </div>
    </aside>
  );
}

function clientColor(id: string): string {
  const colors = ['#2979ff', '#00e676', '#ffc107', '#ff5252', '#e040fb', '#00bcd4'];
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return colors[hash % colors.length];
}
