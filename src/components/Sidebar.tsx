import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BarChart2, TrendingUp, ClipboardList,
  Bot, Bell, Settings, ChevronRight, Zap
} from 'lucide-react';
import { useAlerts } from '../hooks/useAlerts';
import { useClients } from '../hooks/useClients';

const NAV = [
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

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <Zap size={18} />
        </div>
        <div>
          <span className="sidebar-brand-name">Agency OS</span>
          <span className="sidebar-brand-sub">Panel Interno</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navegación</div>
        {NAV.map(({ to, icon: Icon, label, badge }) => {
          const active = to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to);
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
          <div className="sidebar-section-label">Clientes</div>
          {clients.slice(0, 6).map(c => (
            <Link key={c.id} to={`/clients/${c.id}`} className={`sidebar-client-link ${loc.pathname === `/clients/${c.id}` ? 'active' : ''}`}>
              <span className="sidebar-client-dot" style={{ background: clientColor(c.id) }} />
              <span>{c.name}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="sidebar-footer">
        <Link to="/settings" className="sidebar-link small">
          <Settings size={14} />
          <span>Configuración</span>
        </Link>
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
