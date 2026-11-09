import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useClients } from '../hooks/useClients';
import { useMonthlyOperatingKpis } from '../hooks/useData';
import { listMonthlySalesTargets } from '../services/salesTargets';
import type { MonthlySalesTarget } from '../lib/supabase';
import { formatCopExact, formatNumber } from '../lib/utils';
import { getMonthLabel, listAvailableMonthKeys } from '../utils/monthLabel';

// Vista interna multi-cliente del mes seleccionado — el equivalente al
// "resumen de todos los clientes" del artefacto de Juanca (no se pudo leer
// ese artefacto, ver resumen de la tarea), con el kit visual del dashboard.
export function ReportesPage() {
  const { clients, loading: loadingClients } = useClients();
  const { monthlyKpis, loading: loadingKpis } = useMonthlyOperatingKpis(undefined, 12);
  const [salesTargets, setSalesTargets] = useState<MonthlySalesTarget[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const targets = await listMonthlySalesTargets();
      if (!cancelled) setSalesTargets(targets);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const availableMonths = useMemo(
    () => listAvailableMonthKeys(monthlyKpis.map((k) => k.month)),
    [monthlyKpis],
  );
  const activeMonth = selectedMonth ?? availableMonths[0] ?? '';

  const activeClients = useMemo(
    () => clients.filter((c) => c.status === 'active').sort((a, b) => a.name.localeCompare(b.name)),
    [clients],
  );

  const rows = useMemo(() => {
    return activeClients.map((client) => {
      const kpi = monthlyKpis.find((k) => k.client_id === client.id && k.month.slice(0, 7) === activeMonth);
      const target = salesTargets.find((t) => t.client_id === client.id && t.month.slice(0, 7) === activeMonth);
      const leads = kpi ? (kpi.messages > 0 ? kpi.messages : kpi.leads) : 0;
      const costPerLead = kpi && leads > 0 ? kpi.spend / leads : null;
      const pctMeta = target && target.sales_goal > 0 && kpi ? (kpi.total_sales / target.sales_goal) * 100 : null;

      return { client, kpi, leads, costPerLead, pctMeta };
    });
  }, [activeClients, monthlyKpis, salesTargets, activeMonth]);

  const loading = loadingClients || loadingKpis;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reportes</h1>
          <p className="page-subtitle">Comparativa de todos los clientes · vista interna</p>
        </div>
      </div>

      {availableMonths.length > 0 && (
        <div style={{ padding: '0 24px 16px' }}>
          <div className="portal-period-pills">
            {availableMonths.map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`portal-period-pill${activeMonth === m ? ' active' : ''}`}
              >
                {getMonthLabel(m)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card-glass" style={{ margin: '0 24px 24px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'JetBrains Mono', fontSize: '0.72rem', color: 'var(--fg-muted)' }}>
            Cargando reportes...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 880, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Cliente', 'Inversión', 'Leads/Mensajes', 'Costo por lead', '% meta', 'API WhatsApp', ''].map((h, i) => (
                    <th
                      key={h}
                      className="number-label"
                      style={{ padding: '9px 14px', textAlign: i === 0 ? 'left' : 'left', fontWeight: 400, whiteSpace: 'nowrap', fontSize: '0.6rem', color: 'var(--fg-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ client, kpi, leads, costPerLead, pctMeta }) => (
                  <tr key={client.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '9px 14px', fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', color: 'var(--fg)' }}>
                      {client.name}
                    </td>
                    <td style={{ padding: '9px 14px', fontFamily: 'JetBrains Mono', fontSize: '0.76rem', color: kpi ? 'var(--cyan)' : 'var(--fg-muted)' }}>
                      {kpi ? formatCopExact(kpi.spend) : '—'}
                    </td>
                    <td style={{ padding: '9px 14px', fontFamily: 'JetBrains Mono', fontSize: '0.76rem', color: 'var(--fg-2)' }}>
                      {leads > 0 ? formatNumber(leads) : '—'}
                    </td>
                    <td style={{ padding: '9px 14px', fontFamily: 'JetBrains Mono', fontSize: '0.76rem', color: 'var(--fg-2)' }}>
                      {costPerLead != null ? formatCopExact(costPerLead) : '—'}
                    </td>
                    <td style={{ padding: '9px 14px', fontFamily: 'JetBrains Mono', fontSize: '0.76rem', color: pctMeta != null ? (pctMeta >= 100 ? 'var(--success)' : 'var(--fg-2)') : 'var(--fg-muted)' }}>
                      {pctMeta != null ? `${pctMeta.toFixed(0)}%` : '—'}
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <span
                        className="status-pill"
                        style={
                          client.has_whatsapp_api
                            ? { background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid var(--success)' }
                            : { background: 'var(--surface-3)', color: 'var(--fg-muted)', border: '1px solid var(--border)' }
                        }
                      >
                        {client.has_whatsapp_api ? 'API ✓' : 'Sin API'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <Link to={`/portal/${client.id}`} target="_blank" rel="noreferrer" className="portal-link-btn">
                        <ExternalLink size={11} /> Ver reporte
                      </Link>
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--fg-muted)', fontFamily: 'JetBrains Mono', fontSize: '0.72rem' }}>
                      No hay clientes activos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
