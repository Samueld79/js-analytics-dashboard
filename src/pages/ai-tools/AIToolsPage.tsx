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

const STATUS_DOT: Record<string, string> = {
  active: '#22c55e',
  paused: 'hsl(38,92%,55%)',
  churned: '#ef4444',
};

function ClientSelector() {
  const { clients, clientsLoading, selectedClientId, setSelectedClientId, kit } = useAITools();
  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const hasClient = Boolean(selectedClientId);

  if (clientsLoading) {
    return <div style={{ width: 200, height: 34, background: 'var(--color-bg-secondary)', borderRadius: 8 }} />;
  }

  return (
    <>
      <style>{`@keyframes ai-pulse-selector{0%,100%{box-shadow:0 0 0 0 hsl(38,92%,55%,.45)}50%{box-shadow:0 0 0 4px hsl(38,92%,55%,.12)}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select
            value={selectedClientId ?? ''}
            onChange={(e) => setSelectedClientId(e.target.value || null)}
            style={{
              appearance: 'none',
              background: 'var(--color-bg-card)',
              border: hasClient
                ? '1px solid var(--color-border)'
                : '1px solid hsl(38,92%,55%)',
              borderRadius: 8,
              padding: '7px 34px 7px 12px',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: hasClient ? 'var(--color-text-primary)' : 'hsl(38,92%,60%)',
              cursor: 'pointer',
              minWidth: 180,
              maxWidth: 260,
              animation: hasClient ? 'none' : 'ai-pulse-selector 2s ease-in-out infinite',
            }}
          >
            <option value="">⚠️ Seleccionar cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <ChevronDown size={13} style={{ position: 'absolute', right: 10, pointerEvents: 'none', color: 'var(--color-text-muted)' }} />
        </div>

        {selectedClient && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: STATUS_DOT[selectedClient.status] ?? 'var(--color-text-muted)',
                display: 'inline-block',
              }} />
              {kit && (
                <span style={{
                  fontSize: '0.62rem', padding: '1px 7px', borderRadius: 20,
                  background: 'color-mix(in srgb, var(--color-accent-cyan) 12%, transparent)',
                  color: 'var(--color-accent-cyan)', fontWeight: 700, letterSpacing: '0.08em',
                  whiteSpace: 'nowrap',
                }}>
                  KIT ✓
                </span>
              )}
            </div>
            {selectedClient.niche && (
              <span style={{
                fontSize: '0.6rem', color: 'var(--color-text-muted)',
                maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {selectedClient.niche}
              </span>
            )}
          </div>
        )}
      </div>
    </>
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
            <h1 className="page-title">Área de Trabajo</h1>
            <p className="page-subtitle" style={{ letterSpacing: '0.06em', fontSize: '0.72rem' }}>
              ESTRATEGIA · CONTENIDO · IA
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
