import { useEffect, useMemo, useState } from 'react';
import type {
  AdCampaignMetric,
  CampaignAggregateByMonth,
  Client,
  ClientNote,
  DailySale,
  MonthlySalesTarget,
} from '../../lib/supabase';
import { aggregateCampaignMetricsByCampaign } from '../../services/adCampaignMetrics';
import { listMonthlySalesTargets } from '../../services/salesTargets';
import { listPublicClientNotes } from '../../services/clientNotes';
import { formatCopExact, formatNumber } from '../../lib/utils';
import { getMonthLabel } from '../../utils/monthLabel';
import { CHART } from '../../lib/chartColors';

type Props = {
  client: Client;
  // Mismos datos que ya carga ClientDetailPage (useCampaignSummary) — evita
  // una segunda consulta de 365 días y mantiene las cifras idénticas a las
  // tarjetas de KPI de arriba.
  campaignRows: AdCampaignMetric[];
  campaignByMonth: CampaignAggregateByMonth[];
  sales: DailySale[];
};

function pctChange(curr: number, prev: number): number | null {
  if (!prev) return null;
  return ((curr - prev) / prev) * 100;
}

function VariationBadge({ pct }: { pct: number | null }) {
  if (pct == null) {
    return <span style={{ color: 'var(--fg-muted)', fontSize: '0.7rem' }}>sin mes anterior</span>;
  }
  const up = pct >= 0;
  return (
    <span style={{ color: up ? 'var(--success)' : 'var(--danger)', fontSize: '0.72rem', fontWeight: 600 }}>
      {up ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function ProgressBar({ value, goal, color }: { value: number; goal: number; color: string }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div style={{ width: '100%', height: 6, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 300ms' }} />
    </div>
  );
}

// Barras SVG propias (sin librerías) — 2 paneles de 6 meses, cada uno
// normalizado a su propio máximo (inversión y resultados tienen escalas muy
// distintas, un eje compartido las aplastaría).
function MiniBarChart({
  data,
  color,
  formatValue,
}: {
  data: Array<{ month: string; value: number }>;
  color: string;
  formatValue: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length);
  const slot = 240 / n;
  const barWidth = Math.max(6, slot - 10);

  return (
    <svg viewBox="0 0 240 90" width="100%" height={110} role="img" aria-label="Evolución mensual">
      {data.map((d, i) => {
        const barHeight = max > 0 ? (d.value / max) * 60 : 0;
        const x = i * slot + (slot - barWidth) / 2;
        const y = 66 - barHeight;
        return (
          <g key={d.month}>
            <rect x={x} y={y} width={barWidth} height={Math.max(1, barHeight)} fill={color} rx={2} />
            <text x={x + barWidth / 2} y={78} fontSize="7" textAnchor="middle" fill={CHART.axis} fontFamily="JetBrains Mono">
              {getMonthLabel(d.month).slice(0, 3)}
            </text>
            <text x={x + barWidth / 2} y={y - 3} fontSize="6.5" textAnchor="middle" fill="var(--fg-muted)" fontFamily="JetBrains Mono">
              {d.value > 0 ? formatValue(d.value) : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function MonthlyReport({ client, campaignRows, campaignByMonth, sales }: Props) {
  const sortedMonths = useMemo(
    () => [...campaignByMonth].sort((a, b) => a.month.localeCompare(b.month)),
    [campaignByMonth],
  );
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const activeMonth = selectedMonth ?? sortedMonths[sortedMonths.length - 1]?.month ?? '';

  const [salesTargets, setSalesTargets] = useState<MonthlySalesTarget[]>([]);
  const [notes, setNotes] = useState<ClientNote[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [targets, clientNotes] = await Promise.all([
        listMonthlySalesTargets(client.id),
        listPublicClientNotes(client.id),
      ]);
      if (cancelled) return;
      setSalesTargets(targets);
      setNotes(clientNotes);
    })();
    return () => {
      cancelled = true;
    };
  }, [client.id]);

  const monthIndex = sortedMonths.findIndex((m) => m.month === activeMonth);
  const thisMonth = monthIndex >= 0 ? sortedMonths[monthIndex] : null;
  const prevMonth = monthIndex > 0 ? sortedMonths[monthIndex - 1] : null;

  // "Mensajes" o "Leads" según cuál use este cliente — mismo criterio que ya
  // usa la tabla de campañas de ClientDetailPage (c.messages > 0 ? ... : c.leads...).
  const primaryLabel = (thisMonth?.messages ?? 0) > 0 ? 'Mensajes' : 'Leads';
  const primaryResults = thisMonth ? (thisMonth.messages > 0 ? thisMonth.messages : thisMonth.leads) : 0;
  const prevPrimaryResults = prevMonth ? (prevMonth.messages > 0 ? prevMonth.messages : prevMonth.leads) : 0;
  const costPerResult = thisMonth && primaryResults > 0 ? thisMonth.spend / primaryResults : null;

  const spendVariation = thisMonth && prevMonth ? pctChange(thisMonth.spend, prevMonth.spend) : null;
  const resultsVariation = thisMonth && prevMonth ? pctChange(primaryResults, prevPrimaryResults) : null;

  const monthRows = useMemo(() => campaignRows.filter((r) => r.date.startsWith(activeMonth)), [campaignRows, activeMonth]);
  const campaignsThisMonth = useMemo(
    () => [...aggregateCampaignMetricsByCampaign(monthRows)].sort((a, b) => b.spend - a.spend),
    [monthRows],
  );
  const totalClicksThisMonth = campaignsThisMonth.reduce((sum, c) => sum + c.clicks, 0);
  const showClicks = totalClicksThisMonth > 0;
  const showReachOverlapNote = campaignsThisMonth.length > 1;

  const rankedCampaigns = campaignsThisMonth
    .map((c) => {
      const result = c.messages > 0 ? c.messages : c.leads > 0 ? c.leads : c.purchases;
      return { ...c, result, costPerResult: result > 0 ? c.spend / result : null };
    })
    .filter((c) => c.spend > 0);
  const withResult = rankedCampaigns.filter((c) => c.costPerResult != null);
  const bestCampaignId = withResult.length > 1
    ? withResult.reduce((a, b) => (a.costPerResult! < b.costPerResult! ? a : b)).campaignId
    : null;
  const worstCampaignId = withResult.length > 1
    ? withResult.reduce((a, b) => (a.costPerResult! > b.costPerResult! ? a : b)).campaignId
    : null;

  const salesTarget = salesTargets.find((t) => t.month.slice(0, 7) === activeMonth) ?? null;
  const monthSales = sales.filter((s) => s.date.startsWith(activeMonth)).reduce((sum, s) => sum + s.total_sales, 0);

  // "Qué hicimos este mes" = notas de cliente creadas en el mes activo.
  // "Plan próximo mes" = notas de tipo 'strategy' más recientes (son
  // prospectivas por naturaleza, no se escriben "para" un mes específico en
  // el esquema actual de client_notes — decisión documentada en el resumen
  // de la tarea). Nunca se leen notas con visibility='internal'.
  const thisMonthNotes = notes.filter((n) => n.created_at.startsWith(activeMonth));
  const planNotes = notes.filter((n) => n.note_type === 'strategy').slice(0, 3);

  const last6Months = sortedMonths.slice(-6);

  if (sortedMonths.length === 0) {
    return (
      <div className="card-glass card-padded monthly-report">
        <div className="number-label" style={{ marginBottom: 10 }}>Reporte del mes</div>
        <p className="empty-note">Todavía no hay datos de campañas para generar un reporte.</p>
      </div>
    );
  }

  return (
    <div className="monthly-report">
      <div className="monthly-report-header no-print">
        <div className="number-label">Reporte del mes</div>
        <div className="portal-period-pills">
          {sortedMonths.map((m) => (
            <button
              key={m.month}
              onClick={() => setSelectedMonth(m.month)}
              className={`portal-period-pill${activeMonth === m.month ? ' active' : ''}`}
            >
              {getMonthLabel(m.month)}
            </button>
          ))}
        </div>
        <button className="btn-secondary" onClick={() => window.print()}>
          Imprimir / Guardar PDF
        </button>
      </div>

      <div className="monthly-report-print-title" style={{ display: 'none' }}>
        {client.name} — Reporte {getMonthLabel(activeMonth)}
      </div>

      {thisMonth && (
        <div className="card-glass card-padded" style={{ marginBottom: 16 }}>
          <p style={{ fontSize: '0.86rem', lineHeight: 1.6, color: 'var(--fg-2)', margin: 0 }}>
            En {getMonthLabel(activeMonth)}, <strong style={{ color: 'var(--fg)' }}>{client.name}</strong> invirtió{' '}
            <strong style={{ color: 'var(--cyan)' }}>{formatCopExact(thisMonth.spend)}</strong> en pauta
            {primaryResults > 0 && (
              <>
                , generando <strong style={{ color: 'var(--fg)' }}>{formatNumber(primaryResults)} {primaryLabel.toLowerCase()}</strong>
                {costPerResult != null && <> (costo por {primaryLabel.toLowerCase().replace(/s$/, '')} de {formatCopExact(costPerResult)})</>}
              </>
            )}
            . El alcance fue de {formatNumber(thisMonth.reach)} personas con {formatNumber(thisMonth.impressions)} impresiones
            {showClicks && <> y {formatNumber(totalClicksThisMonth)} clics</>}.{' '}
            {prevMonth ? (
              <>
                La inversión {spendVariation != null && spendVariation >= 0 ? 'subió' : 'bajó'} un{' '}
                {spendVariation != null ? Math.abs(spendVariation).toFixed(0) : '—'}% respecto a {getMonthLabel(prevMonth.month)}
                {resultsVariation != null && (
                  <>
                    {' '}y los resultados {resultsVariation >= 0 ? 'subieron' : 'bajaron'} un {Math.abs(resultsVariation).toFixed(0)}%.
                  </>
                )}
              </>
            ) : (
              'No hay un mes anterior todavía para comparar la variación.'
            )}
          </p>
        </div>
      )}

      {thisMonth && (
        <div className="portal-kpi-grid" style={{ marginBottom: 16 }}>
          <div className="card-glass portal-kpi-card">
            <p className="portal-kpi-label">Inversión</p>
            <p className="portal-kpi-value">{formatCopExact(thisMonth.spend)}</p>
            <VariationBadge pct={spendVariation} />
          </div>
          <div className="card-glass portal-kpi-card">
            <p className="portal-kpi-label">Alcance</p>
            <p className="portal-kpi-value">{formatNumber(thisMonth.reach)}</p>
            <p className="portal-kpi-sub">personas únicas</p>
          </div>
          <div className="card-glass portal-kpi-card">
            <p className="portal-kpi-label">{primaryLabel}</p>
            <p className="portal-kpi-value">{formatNumber(primaryResults)}</p>
            <VariationBadge pct={resultsVariation} />
          </div>
          <div className="card-glass portal-kpi-card">
            <p className="portal-kpi-label">Costo por {primaryLabel === 'Mensajes' ? 'mensaje' : 'lead'}</p>
            <p className="portal-kpi-value">{costPerResult != null ? formatCopExact(costPerResult) : '—'}</p>
          </div>
          {salesTarget && (
            <>
              <div className="card-glass portal-kpi-card">
                <p className="portal-kpi-label">Ventas vs meta</p>
                <p className="portal-kpi-value">{formatCopExact(monthSales)}</p>
                <p className="portal-kpi-sub" style={{ marginBottom: 6 }}>meta {formatCopExact(salesTarget.sales_goal)}</p>
                <ProgressBar value={monthSales} goal={salesTarget.sales_goal} color={CHART.green} />
              </div>
              <div className="card-glass portal-kpi-card">
                <p className="portal-kpi-label">Presupuesto vs meta</p>
                <p className="portal-kpi-value">{formatCopExact(thisMonth.spend)}</p>
                <p className="portal-kpi-sub" style={{ marginBottom: 6 }}>meta {formatCopExact(salesTarget.budget_goal)}</p>
                <ProgressBar value={thisMonth.spend} goal={salesTarget.budget_goal} color={CHART.cyan} />
              </div>
            </>
          )}
        </div>
      )}

      {campaignsThisMonth.length > 0 && (
        <div className="card-glass card-padded" style={{ marginBottom: 16 }}>
          <div className="number-label" style={{ marginBottom: 12 }}>
            Campañas — {getMonthLabel(activeMonth)}
          </div>
          <table className="portal-campaign-table">
            <thead>
              <tr>
                {['Campaña', 'Inversión', 'Alcance', 'Resultados', 'Costo por resultado'].map((h, i) => (
                  <th key={h} className={i >= 1 ? 'num-col' : ''}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaignsThisMonth.map((c) => {
                const result = c.messages > 0 ? c.messages : c.leads > 0 ? c.leads : c.purchases;
                const cpr = result > 0 ? c.spend / result : null;
                const isBest = c.campaignId === bestCampaignId;
                const isWorst = c.campaignId === worstCampaignId;
                return (
                  <tr key={c.campaignId || 'sin-id'}>
                    <td className="portal-campaign-name">
                      {c.campaignId ? c.campaignName : `${c.campaignName} (histórico sin ID de campaña)`}
                      {isBest && <span style={{ marginLeft: 6, fontSize: '0.62rem', color: 'var(--success)' }}>● mejor</span>}
                      {isWorst && <span style={{ marginLeft: 6, fontSize: '0.62rem', color: 'var(--danger)' }}>● peor</span>}
                    </td>
                    <td className="num-col">{formatCopExact(c.spend)}</td>
                    <td className="num-col">{formatNumber(c.reach)}</td>
                    <td className="num-col">{result > 0 ? formatNumber(result) : '—'}</td>
                    <td className="num-col">{cpr != null ? formatCopExact(cpr) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {showReachOverlapNote && (
            <p className="empty-note" style={{ marginTop: 10 }}>
              Alcance suma de campañas (puede incluir solapamiento entre audiencias).
            </p>
          )}
        </div>
      )}

      {last6Months.length > 0 && (
        <div className="monthly-report-charts-grid" style={{ marginBottom: 16 }}>
          <div className="card-glass card-padded">
            <div className="number-label" style={{ marginBottom: 10 }}>Inversión — últimos {last6Months.length} meses</div>
            <MiniBarChart
              data={last6Months.map((m) => ({ month: m.month, value: m.spend }))}
              color={CHART.cyan}
              formatValue={(v) => formatCopExact(v)}
            />
          </div>
          <div className="card-glass card-padded">
            <div className="number-label" style={{ marginBottom: 10 }}>Resultados — últimos {last6Months.length} meses</div>
            <MiniBarChart
              data={last6Months.map((m) => ({ month: m.month, value: m.messages > 0 ? m.messages : m.leads }))}
              color={CHART.violet}
              formatValue={(v) => formatNumber(v)}
            />
          </div>
        </div>
      )}

      <div className="monthly-report-charts-grid">
        <div className="card-glass card-padded">
          <div className="number-label" style={{ marginBottom: 10 }}>Qué hicimos este mes</div>
          {thisMonthNotes.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {thisMonthNotes.map((n) => (
                <li key={n.id} style={{ fontSize: '0.8rem', color: 'var(--fg-2)' }}>
                  {n.title && <strong style={{ color: 'var(--fg)' }}>{n.title}: </strong>}
                  {n.body}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">Sin notas registradas para este mes todavía.</p>
          )}
        </div>
        <div className="card-glass card-padded">
          <div className="number-label" style={{ marginBottom: 10 }}>Plan próximo mes</div>
          {planNotes.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {planNotes.map((n) => (
                <li key={n.id} style={{ fontSize: '0.8rem', color: 'var(--fg-2)' }}>
                  {n.title && <strong style={{ color: 'var(--fg)' }}>{n.title}: </strong>}
                  {n.body}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">Sin plan registrado todavía.</p>
          )}
        </div>
      </div>
    </div>
  );
}
