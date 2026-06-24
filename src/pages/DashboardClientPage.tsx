import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ClientAvatar } from '../components/ClientAvatar';
import {
  ComposedChart,
  Bar,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { motion, type Transition } from 'framer-motion';
import { ArrowLeft, Banknote, ChevronDown, ChevronUp, DollarSign, Sparkles, Target } from 'lucide-react';
import { useClients } from '../hooks/useClients';
import { useDailySales } from '../hooks/useDailySales';
import { useCampaignSummary } from '../hooks/useData';
import { aggregateCampaignMetricsByCampaign } from '../services/adCampaignMetrics';
import { getBrandKitByClient, listToolOutputs, type BrandKit, type ToolOutput } from '../services/aiToolsService';
import { formatCop, formatNumber } from '../lib/utils';
import { getCurrentMonthKey } from '../utils/goalHelpers';
import { getMonthLabel } from '../utils/monthLabel';

const BADGE_CFG = {
  objetivo: { text: 'En objetivo',      bg: 'hsl(145 100% 45% / 0.12)', color: '#22c55e', border: 'hsl(145 100% 45% / 0.25)' },
  riesgo:   { text: 'En riesgo',        bg: 'hsl(38 92% 50% / 0.12)',   color: '#f59e0b', border: 'hsl(38 92% 50% / 0.25)' },
  accion:   { text: 'Acción inmediata', bg: 'hsl(0 84% 60% / 0.12)',    color: '#ef4444', border: 'hsl(0 84% 60% / 0.25)' },
  inactivo: { text: 'Sin actividad',    bg: 'hsl(215 15% 50% / 0.12)',  color: 'hsl(215,15%,55%)', border: 'hsl(215 15% 50% / 0.2)' },
} as const;

type BadgeKey = keyof typeof BADGE_CFG;

const STATUS_ETAPA: Record<string, string> = { active: 'Activo', paused: 'Pausado', churned: 'Inactivo' };

const MODE_LABEL: Record<string, string> = {
  generador:   '✨ IA',
  formulario:  '📋 Formulario',
  imagen:      '🖼️ Imagen',
  transcripcion: '🎙️ Voz',
};

type ChartEntry = { dataKey: string; name: string; value: number; color: string };

function CopTooltip({ active, payload, label }: { active?: boolean; payload?: ChartEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--color-tooltip-bg)', border: '1px solid var(--color-tooltip-border)',
      borderRadius: 8, padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)', color: 'var(--color-tooltip-text)',
    }}>
      <p style={{ margin: '0 0 6px', fontSize: '0.62rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {label}
      </p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ margin: '2px 0', color: entry.color, fontSize: '0.72rem' }}>
          {entry.name}:{' '}
          {entry.dataKey === 'ctr' ? `${entry.value.toFixed(2)}%` : formatCop(entry.value)}
        </p>
      ))}
    </div>
  );
}

function KpiCard({ label, value, sub, icon, color, bg }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; color: string; bg: string;
}) {
  return (
    <div className="card-glass" style={{ padding: '16px 18px', borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: '0.6rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
          {label}
        </span>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.03em', lineHeight: 1, fontFamily: 'JetBrains Mono, monospace', marginBottom: sub ? 6 : 0 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono', letterSpacing: '0.04em' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function DashboardClientPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { clients } = useClients();
  const client = clients.find((c) => c.id === clientId);

  const { sales } = useDailySales({ clientId, days: 90 });
  const { rows: campaignRows } = useCampaignSummary(clientId);

  const [kit, setKit] = useState<BrandKit | null>(null);
  const [strategies, setStrategies] = useState<ToolOutput[]>([]);
  const [kitOpen, setKitOpen] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    void getBrandKitByClient(clientId).then(setKit);
    void listToolOutputs({ clientId, toolKey: 'estrategia', limit: 3 }).then(setStrategies);
  }, [clientId]);

  const currentMonthKey = getCurrentMonthKey();

  // ── Monthly KPIs ────────────────────────────────────────────────────────────
  const monthlySales = useMemo(
    () => sales.filter((s) => s.date.startsWith(currentMonthKey)).reduce((sum, s) => sum + s.total_sales, 0),
    [sales, currentMonthKey],
  );

  const monthlySpend = useMemo(
    () => campaignRows.filter((r) => r.date.startsWith(currentMonthKey)).reduce((sum, r) => sum + r.spend, 0),
    [campaignRows, currentMonthKey],
  );

  const monthlyGoal = client?.monthly_goal ?? 0;
  const goalPct = monthlyGoal > 0 ? Math.min(100, Math.round((monthlySales / monthlyGoal) * 100)) : null;

  const badge: BadgeKey = (() => {
    const hasData = monthlySales > 0 || monthlySpend > 0;
    if (!hasData) return 'inactivo';
    if (!monthlyGoal) return 'objetivo';
    const pct = monthlySales / monthlyGoal;
    return pct >= 0.8 ? 'objetivo' : pct >= 0.5 ? 'riesgo' : 'accion';
  })();

  // ── Weekly chart data (8 weeks) ─────────────────────────────────────────────
  const weeklyChartData = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    return Array.from({ length: 8 }, (_, i) => {
      const weeksAgo = 7 - i;
      const wStart = new Date(today);
      wStart.setDate(today.getDate() - daysToMonday - weeksAgo * 7);
      const wEnd = new Date(wStart);
      wEnd.setDate(wStart.getDate() + 6);
      const ws = wStart.toISOString().slice(0, 10);
      const we = wEnd.toISOString().slice(0, 10);

      const weekSales = sales.filter((s) => s.date >= ws && s.date <= we).reduce((sum, s) => sum + s.total_sales, 0);
      const periodRows = campaignRows.filter((r) => r.date >= ws && r.date <= we);
      const weekSpend = periodRows.reduce((sum, r) => sum + r.spend, 0);
      const weekImpressions = periodRows.reduce((sum, r) => sum + r.impressions, 0);
      const weekClicks = periodRows.reduce((sum, r) => sum + r.clicks, 0);
      const ctr = weekImpressions > 0 ? parseFloat(((weekClicks / weekImpressions) * 100).toFixed(2)) : 0;

      const label = wStart.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
      return { label, sales: Math.round(weekSales), spend: Math.round(weekSpend), ctr };
    });
  }, [sales, campaignRows]);

  // Smoothed trend line (3-week rolling average)
  const trendData = useMemo(
    () => weeklyChartData.map((d, i, arr) => {
      const window = arr.slice(Math.max(0, i - 2), i + 1);
      const avg = window.reduce((sum, x) => sum + x.sales, 0) / window.length;
      return { ...d, trend: Math.round(avg) };
    }),
    [weeklyChartData],
  );

  // ── Campaign table (last 30 days) ───────────────────────────────────────────
  const campaignTableData = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const recent = campaignRows.filter((r) => r.date >= cutoffStr);
    return aggregateCampaignMetricsByCampaign(recent)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10)
      .map((c) => ({
        name: c.campaignName,
        spend: c.spend,
        impressions: c.impressions,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
      }));
  }, [campaignRows]);

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: 'easeOut', delay } as Transition,
  });

  if (!client) {
    return (
      <div className="page-content" style={{ padding: '32px 24px' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '0.8rem', marginBottom: 24 }}>
          <ArrowLeft size={14} />Dashboard
        </Link>
        <div style={{ color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono', fontSize: '0.8rem' }}>
          Cliente no encontrado.
        </div>
      </div>
    );
  }

  const bdg = BADGE_CFG[badge];

  return (
    <div className="page-content dashboard-v3" style={{ paddingBottom: 32 }}>

      {/* ── Header ── */}
      <motion.div {...fadeUp(0)} style={{ padding: '24px 24px 0' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: '0.72rem', fontFamily: 'JetBrains Mono', color: 'var(--color-text-muted)' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', textDecoration: 'none' }}>
            <ArrowLeft size={12} />
            Dashboard
          </Link>
          <span>›</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>{client.name}</span>
        </div>

        {/* Client identity row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <ClientAvatar
            clientId={client.id}
            name={client.name}
            logoUrl={client.logo_url}
            size={52}
            borderRadius={12}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {client.name}
              </h1>
              <span style={{
                fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em',
                padding: '3px 10px', borderRadius: 20,
                background: bdg.bg, color: bdg.color, border: `1px solid ${bdg.border}`,
              }}>
                {bdg.text}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono' }}>
              <span>{client.niche ?? '—'}</span>
              <span>·</span>
              <span>{STATUS_ETAPA[client.status] ?? client.status}</span>
              {monthlyGoal > 0 && (
                <>
                  <span>·</span>
                  <span>Meta: <strong style={{ color: 'var(--color-text-secondary)' }}>{formatCop(monthlyGoal)}</strong>/mes</span>
                </>
              )}
            </div>
            {kit?.voice && (
              <div style={{ marginTop: 6, fontSize: '0.68rem', color: 'var(--color-text-muted)', fontStyle: 'italic', maxWidth: 500, lineHeight: 1.5 }}>
                "{kit.voice.slice(0, 120)}{kit.voice.length > 120 ? '…' : ''}"
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── KPI Cards ── */}
      <motion.div
        {...fadeUp(0.08)}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, padding: '20px 24px 0' }}
      >
        <KpiCard
          label={`Ventas · ${getMonthLabel(currentMonthKey)}`}
          value={monthlySales > 0 ? formatCop(monthlySales) : '—'}
          icon={<Banknote size={14} />}
          color="hsl(145,70%,55%)" bg="hsl(145 65% 45% / 0.15)"
        />
        <KpiCard
          label={`Inversión · ${getMonthLabel(currentMonthKey)}`}
          value={monthlySpend > 0 ? formatCop(monthlySpend) : '—'}
          icon={<DollarSign size={14} />}
          color="hsl(200,80%,60%)" bg="hsl(200 80% 55% / 0.15)"
        />
        <KpiCard
          label="Meta mensual"
          value={goalPct !== null ? `${goalPct}%` : '—'}
          sub={monthlyGoal > 0 ? `de ${formatCop(monthlyGoal)}` : 'Sin meta definida'}
          icon={<Target size={14} />}
          color={goalPct !== null ? (goalPct >= 80 ? '#22c55e' : goalPct >= 50 ? '#f59e0b' : '#ef4444') : 'hsl(215,15%,55%)'}
          bg={goalPct !== null ? (goalPct >= 80 ? 'hsl(145 65% 45% / 0.15)' : goalPct >= 50 ? 'hsl(38 92% 50% / 0.15)' : 'hsl(0 84% 60% / 0.15)') : 'hsl(215 15% 50% / 0.1)'}
        />
        <KpiCard
          label="Estrategias generadas"
          value={String(strategies.length)}
          sub="en historial"
          icon={<Sparkles size={14} />}
          color="hsl(280,70%,65%)" bg="hsl(280 70% 60% / 0.15)"
        />
      </motion.div>

      {/* ── Charts Row ── */}
      <motion.div
        {...fadeUp(0.16)}
        style={{ display: 'grid', gridTemplateColumns: '60% 40%', gap: 16, padding: '20px 24px 0' }}
      >
        {/* Chart 1: BarChart weekly sales + trend line */}
        <div className="card-glass" style={{ padding: '16px 20px' }}>
          <div style={{ marginBottom: 14 }}>
            <p style={{ margin: '0 0 3px', fontSize: '0.58rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Últimas 8 semanas
            </p>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
              Ventas semanales
            </h3>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#06b6d4' }} />
              <span style={{ fontSize: '0.6rem', fontFamily: 'JetBrains Mono', color: 'var(--color-text-muted)' }}>Ventas</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 16, height: 2, background: '#f59e0b', borderRadius: 1 }} />
              <span style={{ fontSize: '0.6rem', fontFamily: 'JetBrains Mono', color: 'var(--color-text-muted)' }}>Tendencia</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={trendData}>
              <defs>
                <linearGradient id="clientSalesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-chart-text)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--color-chart-text)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCop(v)} />
              <Tooltip content={<CopTooltip />} />
              <Bar dataKey="sales" name="Ventas" fill="url(#clientSalesGrad)" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="trend" name="Tendencia" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: LineChart weekly spend + CTR */}
        <div className="card-glass" style={{ padding: '16px 20px' }}>
          <div style={{ marginBottom: 14 }}>
            <p style={{ margin: '0 0 3px', fontSize: '0.58rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Últimas 8 semanas
            </p>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
              Actividad de ads
            </h3>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 2, background: '#8b5cf6', borderRadius: 1 }} />
              <span style={{ fontSize: '0.6rem', fontFamily: 'JetBrains Mono', color: 'var(--color-text-muted)' }}>Inversión</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 2, background: '#f59e0b', borderRadius: 1 }} />
              <span style={{ fontSize: '0.6rem', fontFamily: 'JetBrains Mono', color: 'var(--color-text-muted)' }}>CTR%</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weeklyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-chart-text)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'var(--color-chart-text)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCop(v)} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'var(--color-chart-text)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<CopTooltip />} />
              <Line yAxisId="left" type="monotone" dataKey="spend" name="Inversión" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }} activeDot={{ r: 5 }} />
              <Line yAxisId="right" type="monotone" dataKey="ctr" name="CTR" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* ── Campaign Table ── */}
      {campaignTableData.length > 0 && (
        <motion.div {...fadeUp(0.24)} style={{ padding: '20px 24px 0' }}>
          <div className="card-glass" style={{ overflow: 'hidden', borderRadius: 12 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
              <p style={{ margin: '0 0 2px', fontSize: '0.58rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Últimos 30 días
              </p>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
                Campañas activas
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['Campaña', 'Inversión', 'Impresiones', 'CTR', 'CPM'].map((h) => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'JetBrains Mono', fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaignTableData.map((row, i) => {
                    const ctrColor = row.ctr > 2 ? '#22c55e' : row.ctr >= 1 ? '#f59e0b' : '#ef4444';
                    const ctrBg = row.ctr > 2 ? 'hsl(145 100% 45% / 0.1)' : row.ctr >= 1 ? 'hsl(38 92% 50% / 0.1)' : 'hsl(0 84% 60% / 0.1)';
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '11px 16px', fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', color: 'var(--color-text-primary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.name}
                        </td>
                        <td style={{ padding: '11px 16px', fontFamily: 'JetBrains Mono', fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>
                          {formatCop(row.spend)}
                        </td>
                        <td style={{ padding: '11px 16px', fontFamily: 'JetBrains Mono', fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>
                          {formatNumber(row.impressions)}
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: '0.64rem', fontWeight: 700, fontFamily: 'JetBrains Mono', background: ctrBg, color: ctrColor, border: `1px solid ${ctrColor}40` }}>
                            {row.ctr.toFixed(2)}%
                          </span>
                        </td>
                        <td style={{ padding: '11px 16px', fontFamily: 'JetBrains Mono', fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>
                          {formatCop(row.cpm)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Latest Strategies ── */}
      {strategies.length > 0 && (
        <motion.div {...fadeUp(0.3)} style={{ padding: '20px 24px 0' }}>
          <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={13} style={{ color: 'var(--color-accent-cyan)' }} />
            <span style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Últimas estrategias
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {strategies.map((s) => {
              const mode = (s.inputs as Record<string, string> | undefined)?.mode;
              const modeLabel = mode ? (MODE_LABEL[mode] ?? mode) : '📄 Estrategia';
              const preview = s.output.slice(0, 100).replace(/\n/g, ' ') + (s.output.length > 100 ? '…' : '');
              const date = new Date(s.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' });
              return (
                <div key={s.id} className="card-glass" style={{ padding: '14px 18px', borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', padding: '2px 9px', borderRadius: 20,
                      background: 'color-mix(in srgb, var(--color-accent-cyan) 12%, transparent)',
                      color: 'var(--color-accent-cyan)',
                      border: '1px solid color-mix(in srgb, var(--color-accent-cyan) 25%, transparent)',
                    }}>
                      {modeLabel}
                    </span>
                    <span style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono' }}>
                      {date}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: '0.76rem', color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
                    {preview}
                  </p>
                  <Link
                    to={`/ai-tools/historial?preview=${s.id}`}
                    style={{ fontSize: '0.7rem', color: 'var(--color-accent-cyan)', textDecoration: 'none', fontWeight: 600, fontFamily: 'JetBrains Mono' }}
                  >
                    Ver organigrama completo →
                  </Link>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Kit de Marca (collapsible) ── */}
      <motion.div {...fadeUp(0.36)} style={{ padding: '20px 24px 0' }}>
        <button
          onClick={() => setKitOpen((o) => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
            borderRadius: kitOpen ? '10px 10px 0 0' : 10,
            padding: '14px 18px', cursor: 'pointer', color: 'var(--color-text-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
              Kit de Marca
            </span>
            <span style={{
              fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: kit
                ? 'color-mix(in srgb, var(--color-accent-cyan) 12%, transparent)'
                : 'var(--color-badge-bg)',
              color: kit ? 'var(--color-accent-cyan)' : 'var(--color-text-muted)',
              border: kit
                ? '1px solid color-mix(in srgb, var(--color-accent-cyan) 25%, transparent)'
                : '1px solid var(--color-border)',
            }}>
              {kit ? 'Configurado ✓' : 'Sin configurar'}
            </span>
          </div>
          {kitOpen ? <ChevronUp size={14} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />}
        </button>

        {kitOpen && (
          <div style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderTop: 'none',
            borderRadius: '0 0 10px 10px',
            padding: '16px 18px',
          }}>
            {!kit ? (
              <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono' }}>
                No hay Kit de Marca configurado para este cliente.{' '}
                <Link to="/ai-tools/kit" style={{ color: 'var(--color-accent-cyan)', textDecoration: 'none' }}>
                  Crear en Área de Trabajo →
                </Link>
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                {[
                  { label: 'Nombre', value: kit.name },
                  { label: 'Colores', value: kit.colors },
                  { label: 'Fuentes', value: kit.fonts },
                  { label: 'Voz de marca', value: kit.voice },
                  { label: 'Audiencias', value: kit.audiences },
                  { label: 'Diferenciadores', value: kit.differentiators },
                  { label: 'No hacer', value: kit.do_not },
                ].filter((f) => f.value).map((field) => (
                  <div key={field.label} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-input)' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '0.56rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      {field.label}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                      {field.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>

    </div>
  );
}
