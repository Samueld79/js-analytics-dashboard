import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Sparkles, ChevronDown } from 'lucide-react';
import { AIToolsProvider, useAITools } from '../../hooks/useAIToolsContext';
import { AIToolsHome } from './AIToolsHome';
import { AIToolsTool } from './AIToolsTool';
import { AIToolsKit } from './AIToolsKit';
import { AIToolsMemories } from './AIToolsMemories';
import { AIToolsHistory } from './AIToolsHistory';

const NAV_TABS = [
  { to: '/ai-tools', label: 'Herramientas', exact: true },
  { to: '/ai-tools/kit', label: 'Kit de Marca' },
  { to: '/ai-tools/memorias', label: 'Memorias' },
  { to: '/ai-tools/historial', label: 'Historial' },
];

function ClientSelector() {
  const { clients, clientsLoading, selectedClientId, setSelectedClientId, kit } = useAITools();

  if (clientsLoading) return <div style={{ width: 200, height: 34, background: 'var(--color-bg-secondary)', borderRadius: 8 }} />;

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select
        value={selectedClientId ?? ''}
        onChange={(e) => setSelectedClientId(e.target.value || null)}
        style={{
          appearance: 'none',
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: '7px 34px 7px 12px',
          fontSize: '0.82rem',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          cursor: 'pointer',
          minWidth: 180,
          maxWidth: 260,
        }}
      >
        <option value="">Sin cliente</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <ChevronDown size={13} style={{
        position: 'absolute',
        right: 10,
        pointerEvents: 'none',
        color: 'var(--color-text-muted)',
      }} />
      {kit && (
        <span style={{
          marginLeft: 8,
          fontSize: '0.65rem',
          padding: '2px 8px',
          borderRadius: 20,
          background: 'color-mix(in srgb, var(--color-accent-cyan) 12%, transparent)',
          color: 'var(--color-accent-cyan)',
          fontWeight: 700,
          letterSpacing: '0.08em',
          whiteSpace: 'nowrap',
        }}>
          KIT ✓
        </span>
      )}
    </div>
  );
}

function AIToolsLayout() {
  const loc = useLocation();

  return (
    <div className="page-content">
      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={20} style={{ color: 'var(--color-accent-cyan)' }} />
          <div>
            <h1 className="page-title">AI Tools</h1>
            <p className="page-subtitle" style={{ letterSpacing: '0.06em', fontSize: '0.72rem' }}>
              HERRAMIENTAS · ESTRATEGIA · CONTENIDO
            </p>
          </div>
        </div>
        <ClientSelector />
      </div>

      {/* Tab navigation */}
      <div style={{
        display: 'flex',
        gap: 4,
        borderBottom: '1px solid var(--color-border)',
        marginTop: 20,
        marginBottom: 24,
      }}>
        {NAV_TABS.map((tab) => {
          const isActive = tab.exact
            ? loc.pathname === tab.to
            : loc.pathname.startsWith(tab.to);

          return (
            <Link
              key={tab.to}
              to={tab.to}
              style={{
                textDecoration: 'none',
                padding: '8px 14px',
                fontSize: '0.82rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--color-accent-cyan)' : 'var(--color-text-muted)',
                borderBottom: isActive
                  ? '2px solid var(--color-accent-cyan)'
                  : '2px solid transparent',
                marginBottom: -1,
                transition: 'color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Sub-routes */}
      <Routes>
        <Route index element={<AIToolsHome />} />
        <Route path="kit" element={<AIToolsKit />} />
        <Route path="memorias" element={<AIToolsMemories />} />
        <Route path="historial" element={<AIToolsHistory />} />
        <Route path=":toolKey" element={<AIToolsTool />} />
      </Routes>
    </div>
  );
}

export function AIToolsPage() {
  return (
    <AIToolsProvider>
      <AIToolsLayout />
    </AIToolsProvider>
  );
}
