import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { motion, type Transition } from 'framer-motion';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  DollarSign,
  MessageCircle,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAlerts } from '../hooks/useAlerts';
import { useAuth } from '../hooks/useAuth';
import { useClients } from '../hooks/useClients';
import { useDailySales } from '../hooks/useDailySales';
import {
  useAdMetrics,
  useMetaSyncRows,
  useMonthlyOperatingKpis,
  useTasks,
} from '../hooks/useData';
import { useSocialMonthlyMetrics } from '../hooks/useSocialMonthlyMetrics';
import type { AdMetric, DailySale } from '../lib/supabase';
import {
  buildMarketingActionSummary,
  formatCop,
  formatNumber,
  formatRoas,
  isAlertSnoozed,
  sumMetrics,
  sumOperatingKpis,
  sumSales,
} from '../lib/utils';
import { buildClientMetaOverviewByClient } from '../services/meta';
import { getMonthKey, getMonthLabel, listAvailableMonthKeys } from '../utils/monthLabel';

const EMPTY_CLIENT_SCOPE = '00000000-0000-0000-0000-000000000000';

type ChartPayloadEntry = {
  dataKey: string;
  name: string;
  value: number;
  color: string;
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ChartPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'hsl(220,18%,9%)',
        border: '1px solid hsl(0 0% 100% / 0.1)',
        borderRadius: '4px',
        padding: '10px 14px',
        fontFamily: 'JetBrains Mono',
      }}
    >
      <p
        style={{
          fontSize: '0.65rem',
          color: 'hsl(215,15%,55%)',
          marginBottom: '6px',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          margin: '0 0 6px',
        }}
      >
        {label}
      </p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ fontSize: '0.72rem', color: entry.color, margin: '2px 0' }}>
          {entry.name}: {entry.value.toLocaleString('es-CO')}
        </p>
      ))}
    </div>
  );
}

export function DashboardPage() {
  // ── Data hooks ──────────────────────────────────────────────────────────────
  const { clients } = useClients();
  const { isInternal, accessibleClientIds, defaultClientId } = useAuth();
  const { alerts, unreadCount } = useAlerts();
  const { tasks } = useTasks();
  const scopedClientId =
    !isInternal && accessibleClientIds.length <= 1
      ? defaultClientId ?? EMPTY_CLIENT_SCOPE
      : undefined;
  const { monthlyKpis } = useMonthlyOperatingKpis(scopedClientId, 6);
  const { metrics: rawAdMetrics } = useAdMetrics(scopedClientId, 180);
  const { sales } = useDailySales({ clientId: scopedClientId, days: 180 });
  const { metrics: socialMonthlyMetrics } = useSocialMonthlyMetrics(scopedClientId, 12);
  const { syncRows } = useMetaSyncRows(scopedClientId);

  // ── Scoping ─────────────────────────────────────────────────────────────────
  const visibleClientIds = useMemo(
    () => new Set(isInternal ? clients.map((c) => c.id) : accessibleClientIds),
    [accessibleClientIds, clients, isInternal],
  );
  const visibleClients = useMemo(
    () =>
      isInternal ? clients : clients.filter((c) => visibleClientIds.has(c.id)),
    [clients, isInternal, visibleClientIds],
  );
  const scopedMonthlyKpis = useMemo(
    () =>
      isInternal
        ? monthlyKpis
        : monthlyKpis.filter((r) => visibleClientIds.has(r.client_id)),
    [isInternal, monthlyKpis, visibleClientIds],
  );
  const scopedAdMetrics = useMemo(
    () =>
      isInternal
        ? rawAdMetrics
        : rawAdMetrics.filter((r) => visibleClientIds.has(r.client_id)),
    [isInternal, rawAdMetrics, visibleClientIds],
  );
  const scopedSales = useMemo(
    () =>
      isInternal ? sales : sales.filter((r) => visibleClientIds.has(r.client_id)),
    [isInternal, sales, visibleClientIds],
  );
  const scopedSocialMonthlyMetrics = useMemo(
    () =>
      isInternal
        ? socialMonthlyMetrics
        : socialMonthlyMetrics.filter((r) => visibleClientIds.has(r.client_id)),
    [isInternal, socialMonthlyMetrics, visibleClientIds],
  );
  const scopedSyncRows = useMemo(
    () =>
      isInternal ? syncRows : syncRows.filter((r) => visibleClientIds.has(r.client_id)),
    [isInternal, syncRows, visibleClientIds],
  );
  const scopedAlerts = useMemo(
    () =>
      isInternal
        ? alerts
        : alerts.filter((a) => a.client_id && visibleClientIds.has(a.client_id)),
    [alerts, isInternal, visibleClientIds],
  );
  const scopedTasks = useMemo(
    () =>
      isInternal
        ? tasks
        : tasks.filter((t) => t.client_id && visibleClientIds.has(t.client_id)),
    [isInternal, tasks, visibleClientIds],
  );

  // ── Executive month ─────────────────────────────────────────────────────────
  const executiveMonth =
    listAvailableMonthKeys([
      ...scopedMonthlyKpis.map((r) => r.month),
      ...scopedAdMetrics.map((r) => r.date),
      ...scopedSales.map((r) => r.date),
      ...scopedSocialMonthlyMetrics.map((r) => r.month),
    ])[0] ?? new Date().toISOString().slice(0, 7);
  const executiveMonthLabel = getMonthLabel(executiveMonth);
  const portalClientName =
    !isInternal && visibleClients.length === 1
      ? visibleClients[0]?.name ?? 'Mi empresa'
      : null;

  // ── Filtered by executive month ─────────────────────────────────────────────
  const executiveRows = scopedMonthlyKpis.filter(
    (r) => getMonthKey(r.month) === executiveMonth,
  );
  const executiveAdMetrics = scopedAdMetrics.filter(
    (r) => getMonthKey(r.date) === executiveMonth,
  );
  const executiveSales = scopedSales.filter(
    (r) => getMonthKey(r.date) === executiveMonth,
  );
  const executiveSocialMetrics = scopedSocialMonthlyMetrics.filter(
    (r) => getMonthKey(r.month) === executiveMonth,
  );

  // ── Meta overview ────────────────────────────────────────────────────────────
  const metaByClient = useMemo(
    () =>
      buildClientMetaOverviewByClient({
        clientIds: visibleClients.map((c) => c.id),
        monthlyKpis: scopedMonthlyKpis,
        syncRows: scopedSyncRows,
      }),
    [scopedMonthlyKpis, scopedSyncRows, visibleClients],
  );

  // ── Aggregates ───────────────────────────────────────────────────────────────
  const overall = executiveRows.length
    ? sumOperatingKpis(executiveRows)
    : buildCombinedMonthTotals(executiveAdMetrics, executiveSales);
  const marketing = buildMarketingActionSummary(executiveAdMetrics);

  // ── Alerts ───────────────────────────────────────────────────────────────────
  const visibleOpenAlerts = useMemo(
    () =>
      scopedAlerts.filter(
        (a) => ['unread', 'read'].includes(a.status) && !isAlertSnoozed(a),
      ),
    [scopedAlerts],
  );

  const clientAlertCount = new Map<string, number>();
  const clientCriticalAlertCount = new Map<string, number>();
  visibleOpenAlerts.forEach((alert) => {
    if (!alert.client_id) return;
    clientAlertCount.set(
      alert.client_id,
      (clientAlertCount.get(alert.client_id) ?? 0) + 1,
    );
    if (alert.severity === 'critical') {
      clientCriticalAlertCount.set(
        alert.client_id,
        (clientCriticalAlertCount.get(alert.client_id) ?? 0) + 1,
      );
    }
  });

  // ── KPI values ───────────────────────────────────────────────────────────────
  const clientsWithAlerts = new Set(
    visibleOpenAlerts.map((a) => a.client_id).filter(Boolean),
  ).size;
  const salesRecordCount = executiveSales.length;
  const costPerConversation =
    marketing.messagingStarted > 0
      ? overall.spend / marketing.messagingStarted
      : null;
  const averageTicket =
    salesRecordCount > 0 ? overall.total_sales / salesRecordCount : null;
  const pendingTasks = scopedTasks.filter((t) => t.status === 'pending').length;

  // ── Client executive rows ────────────────────────────────────────────────────
  const clientExecutiveRows = visibleClients
    .map((client) => {
      const monthRow = executiveRows.find((r) => r.client_id === client.id) ?? null;
      const monthTotals =
        monthRow ??
        buildCombinedMonthTotals(
          executiveAdMetrics.filter((r) => r.client_id === client.id),
          executiveSales.filter((r) => r.client_id === client.id),
        );
      const meta = metaByClient[client.id] ?? null;
      const socialMetric =
        executiveSocialMetrics.find((r) => r.client_id === client.id) ?? null;
      const alertCount = clientAlertCount.get(client.id) ?? 0;
      const criticalCount = clientCriticalAlertCount.get(client.id) ?? 0;
      return { client, monthTotals, meta, socialMetric, alertCount, criticalCount };
    })
    .filter(
      (e) =>
        e.monthTotals.spend > 0 ||
        e.monthTotals.total_sales > 0 ||
        e.alertCount > 0 ||
        Boolean(e.socialMetric) ||
        Boolean(e.meta?.active_accounts),
    )
    .sort((a, b) => {
      if (b.monthTotals.real_roas !== a.monthTotals.real_roas)
        return b.monthTotals.real_roas - a.monthTotals.real_roas;
      if (b.monthTotals.total_sales !== a.monthTotals.total_sales)
        return b.monthTotals.total_sales - a.monthTotals.total_sales;
      return b.monthTotals.spend - a.monthTotals.spend;
    });

  // ── Chart data ───────────────────────────────────────────────────────────────
  const dailyChartData = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const byDate = new Map<string, { spend: number; messages: number }>();
    scopedAdMetrics
      .filter((m) => new Date(m.date + 'T00:00:00') >= cutoff)
      .forEach((m) => {
        const prev = byDate.get(m.date) ?? { spend: 0, messages: 0 };
        byDate.set(m.date, {
          spend: prev.spend + m.spend,
          messages: prev.messages + m.messages,
        });
      });
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({
        date: new Date(date + 'T00:00:00').toLocaleDateString('es-CO', {
          day: '2-digit',
          month: 'short',
        }),
        spend: Math.round(vals.spend),
        messages: vals.messages,
      }));
  }, [scopedAdMetrics]);

  const clientSpendData = useMemo(
    () =>
      [...clientExecutiveRows]
        .filter((e) => e.monthTotals.spend > 0)
        .sort((a, b) => b.monthTotals.spend - a.monthTotals.spend)
        .slice(0, 6)
        .map((e) => ({
          name:
            e.client.name.length > 14
              ? e.client.name.slice(0, 14) + '…'
              : e.client.name,
          spend: Math.round(e.monthTotals.spend),
        })),
    [clientExecutiveRows],
  );

  const tableClients = useMemo(
    () =>
      [...clientExecutiveRows]
        .sort((a, b) => b.monthTotals.spend - a.monthTotals.spend)
        .slice(0, 8),
    [clientExecutiveRows],
  );

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const currentMonthLabel = new Date()
    .toLocaleString('es-ES', { month: 'long', year: 'numeric' })
    .toUpperCase();

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: 'easeOut', delay } as Transition,
  });

  const kpiItems: Array<{ label: string; value: string; Icon: LucideIcon }> = [
    {
      label: `Inversión ${executiveMonthLabel}`,
      value: formatCop(overall.spend),
      Icon: DollarSign,
    },
    {
      label: `Conversaciones ${executiveMonthLabel}`,
      value: formatNumber(marketing.messagingStarted),
      Icon: MessageCircle,
    },
    {
      label: 'Costo / Conv.',
      value: costPerConversation != null ? formatCop(costPerConversation) : '—',
      Icon: TrendingDown,
    },
    {
      label: `Ventas ${executiveMonthLabel}`,
      value: formatCop(overall.total_sales),
      Icon: ShoppingCart,
    },
    {
      label: 'Ticket promedio',
      value: averageTicket != null ? formatCop(averageTicket) : '—',
      Icon: BarChart3,
    },
    {
      label: 'Clientes con alertas',
      value: String(clientsWithAlerts),
      Icon: Bell,
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="page-content dashboard-v3">
      {/* ── Header ── */}
      <motion.div className="page-header" {...fadeUp(0)}>
        <div>
          <h1 className="page-title">
            {portalClientName ? `Resultados de ${portalClientName}` : 'Dashboard General'}
          </h1>
          <p className="page-subtitle">
            {portalClientName
              ? `PANEL DE RESULTADOS · ${currentMonthLabel}`
              : `RESUMEN GENERAL · ${currentMonthLabel}`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {pendingTasks > 0 && (
            <span
              style={{
                fontFamily: 'JetBrains Mono',
                fontSize: '0.65rem',
                letterSpacing: '0.08em',
                color: 'hsl(215,15%,55%)',
              }}
            >
              {pendingTasks} tarea{pendingTasks !== 1 ? 's' : ''} pendiente
              {pendingTasks !== 1 ? 's' : ''}
            </span>
          )}
          {unreadCount > 0 && (
            <Link to="/alerts" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={13} />
              {unreadCount} alerta{unreadCount !== 1 ? 's' : ''}
            </Link>
          )}
          <Link to="/metrics" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BarChart3 size={13} />
            Ver desempeño
          </Link>
        </div>
      </motion.div>

      {/* ── KPI Grid ── */}
      <div className="dashboard-kpi-grid">
        {kpiItems.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            className="card-glass"
            style={{ padding: '20px', borderRadius: '4px' }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: 'easeOut' } as Transition}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px',
              }}
            >
              <span className="number-label">{kpi.label}</span>
              <kpi.Icon size={14} style={{ color: 'hsl(215,15%,40%)' }} />
            </div>
            <div
              className="font-display"
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: 'hsl(0,0%,98%)',
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              {kpi.value}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '10px',
              }}
            >
              <TrendingUp size={11} style={{ color: 'hsl(180,100%,50%)' }} />
              <span
                style={{
                  fontFamily: 'JetBrains Mono',
                  fontSize: '0.62rem',
                  color: 'hsl(215,15%,50%)',
                }}
              >
                vs mes anterior
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="dashboard-charts-row">
        {/* Area Chart — Inversión & Mensajes */}
        <motion.div
          className="card-glass"
          style={{ padding: '24px', borderRadius: '4px' }}
          {...fadeUp(0.25)}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '24px',
            }}
          >
            <div>
              <span className="number-label" style={{ display: 'block', marginBottom: '4px' }}>
                Rendimiento
              </span>
              <h3
                className="font-display"
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  color: 'hsl(0,0%,98%)',
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}
              >
                Inversión &amp; Mensajes
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <div
                  style={{
                    width: '9px',
                    height: '9px',
                    borderRadius: '50%',
                    background: 'hsl(180,100%,50%)',
                  }}
                />
                <span className="number-label">Inversión</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <div
                  style={{
                    width: '9px',
                    height: '9px',
                    borderRadius: '50%',
                    background: 'hsl(280,80%,60%)',
                  }}
                />
                <span className="number-label">Mensajes</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={dailyChartData}>
              <defs>
                <linearGradient id="colorInversion" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(180,100%,50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(180,100%,50%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorMensajes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(280,80%,60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(280,80%,60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.05)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'hsl(215,15%,55%)', fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(215,15%,55%)', fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="spend"
                name="Inversión"
                stroke="hsl(180,100%,50%)"
                strokeWidth={2}
                fill="url(#colorInversion)"
              />
              <Area
                type="monotone"
                dataKey="messages"
                name="Mensajes"
                stroke="hsl(280,80%,60%)"
                strokeWidth={2}
                fill="url(#colorMensajes)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Bar Chart — Inversión por cliente */}
        <motion.div
          className="card-glass"
          style={{ padding: '24px', borderRadius: '4px' }}
          {...fadeUp(0.3)}
        >
          <div style={{ marginBottom: '24px' }}>
            <span className="number-label" style={{ display: 'block', marginBottom: '4px' }}>
              Top clientes
            </span>
            <h3
              className="font-display"
              style={{
                fontSize: '1.1rem',
                fontWeight: 600,
                color: 'hsl(0,0%,98%)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Inversión por cliente
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={clientSpendData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.05)" />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: 'hsl(215,15%,55%)', fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fontSize: 10, fill: 'hsl(215,15%,55%)', fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="spend"
                name="Inversión"
                fill="hsl(180,100%,50%)"
                radius={[0, 2, 2, 0]}
                fillOpacity={0.85}
              />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* ── Client Table ── */}
      <motion.div
        className="card-glass"
        style={{ borderRadius: '4px', overflow: 'hidden' }}
        {...fadeUp(0.35)}
      >
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid hsl(0 0% 100% / 0.08)',
          }}
        >
          <span className="number-label" style={{ display: 'block', marginBottom: '4px' }}>
            Clientes activos
          </span>
          <h3
            className="font-display"
            style={{
              fontSize: '1.1rem',
              fontWeight: 600,
              color: 'hsl(0,0%,98%)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Rendimiento del mes
          </h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid hsl(0 0% 100% / 0.08)' }}>
                {['Cliente', 'Inversión', 'Ventas', 'ROAS Op.', 'Estado'].map((h) => (
                  <th
                    key={h}
                    className="number-label"
                    style={{ padding: '12px 24px', textAlign: 'left', fontWeight: 400 }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableClients.map(({ client, monthTotals, alertCount }) => (
                <tr
                  key={client.id}
                  style={{ borderBottom: '1px solid hsl(0 0% 100% / 0.05)' }}
                >
                  <td style={{ padding: '14px 24px' }}>
                    <Link
                      to={`/clients/${client.id}`}
                      style={{
                        fontFamily: 'Outfit, sans-serif',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'hsl(0,0%,92%)',
                        textDecoration: 'none',
                      }}
                    >
                      {client.name}
                    </Link>
                  </td>
                  <td
                    style={{
                      padding: '14px 24px',
                      fontFamily: 'JetBrains Mono',
                      fontSize: '0.78rem',
                      color: 'hsl(0,0%,85%)',
                    }}
                  >
                    {formatCop(monthTotals.spend)}
                  </td>
                  <td
                    style={{
                      padding: '14px 24px',
                      fontFamily: 'JetBrains Mono',
                      fontSize: '0.78rem',
                      color: 'hsl(0,0%,85%)',
                    }}
                  >
                    {monthTotals.total_sales > 0 ? formatCop(monthTotals.total_sales) : '—'}
                  </td>
                  <td style={{ padding: '14px 24px' }}>
                    <span className={roasClass(monthTotals.real_roas)}>
                      {formatRoas(monthTotals.real_roas)}
                    </span>
                  </td>
                  <td style={{ padding: '14px 24px' }}>
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono',
                        fontSize: '0.62rem',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        ...(alertCount > 0
                          ? {
                              background: 'hsl(0 84% 60% / 0.12)',
                              color: 'hsl(0,84%,65%)',
                              border: '1px solid hsl(0 84% 60% / 0.2)',
                            }
                          : {
                              background: 'hsl(145 100% 45% / 0.12)',
                              color: 'hsl(145,100%,45%)',
                              border: '1px solid hsl(145 100% 45% / 0.2)',
                            }),
                      }}
                    >
                      {alertCount > 0
                        ? `${alertCount} alerta${alertCount > 1 ? 's' : ''}`
                        : 'OK'}
                    </span>
                  </td>
                </tr>
              ))}
              {tableClients.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: '32px 24px',
                      textAlign: 'center',
                      fontFamily: 'JetBrains Mono',
                      fontSize: '0.72rem',
                      color: 'hsl(215,15%,40%)',
                    }}
                  >
                    No hay clientes con datos para el mes actual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

// ── Helper functions ──────────────────────────────────────────────────────────

function buildCombinedMonthTotals(metrics: AdMetric[], sales: DailySale[]) {
  const metricTotals = sumMetrics(metrics);
  const salesTotals = sumSales(sales);
  const spend = metricTotals.spend;
  const totalSales = salesTotals.total;

  return {
    ...metricTotals,
    total_sales: totalSales,
    new_client_sales: salesTotals.newClient,
    repeat_sales: salesTotals.repeat,
    physical_store_sales: salesTotals.physical,
    online_sales: salesTotals.online,
    ad_roas: metricTotals.roas,
    real_roas: spend > 0 ? totalSales / spend : 0,
  };
}

function roasClass(roas: number): string {
  if (roas >= 3) return 'roas-pill roas-good';
  if (roas >= 2) return 'roas-pill roas-ok';
  return 'roas-pill roas-low';
}
