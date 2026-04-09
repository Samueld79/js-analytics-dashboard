import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { motion, type Transition } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  DollarSign,
  MessageCircle,
  Pencil,
  Percent,
  Plus,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useClients } from '../hooks/useClients';
import { useDailySales } from '../hooks/useDailySales';
import { useCampaignSummary } from '../hooks/useData';
import {
  aggregateCampaignMetricsByMonth,
  sumCampaignMonthAggregates,
} from '../services/adCampaignMetrics';
import { formatCop, formatNumber, getDateKey, sumSales } from '../lib/utils';
import { getMonthLabel } from '../utils/monthLabel';

const EMPTY_SCOPE = '00000000-0000-0000-0000-000000000000';

function shortMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  if (!year || !month) return monthKey;
  const d = new Date(Number(year), Number(month) - 1);
  return d.toLocaleString('es-CO', { month: 'short' }).replace('.', '');
}

function shortDate(dateStr: string): string {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const parts = dateStr.split('-');
  const mm = parts[1] ?? '1';
  const dd = parts[2] ?? '1';
  return `${parseInt(dd, 10)} ${months[parseInt(mm, 10) - 1] ?? '?'}`;
}

function formatCopCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

// Full format with period as thousands separator (Colombian style: $23.400.000)
function formatCopFull(value: number): string {
  return `$${Math.round(value).toLocaleString('es-CO')}`;
}

function actionBtn(variant: 'cyan' | 'red' | 'muted') {
  const base = {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    width: 24,
    height: 24,
    borderRadius: 5,
    border: 'none',
    cursor: 'pointer',
    background: '',
    color: '',
  };
  if (variant === 'cyan') return { ...base, background: 'hsl(180 100% 45% / 0.15)', color: 'hsl(180,100%,55%)' };
  if (variant === 'red') return { ...base, background: 'hsl(0 84% 60% / 0.12)', color: 'hsl(0,84%,65%)' };
  return { ...base, background: 'rgba(255,255,255,0.06)', color: 'hsl(215,15%,55%)' };
}

const QUICK_INPUT: React.CSSProperties = {
  flex: 1,
  padding: '5px 8px',
  fontSize: '0.8rem',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
  color: 'inherit',
  minWidth: 0,
};

export function SalesPage() {
  const today = getDateKey();
  const { clients, loading: clientsLoading } = useClients();
  const { isInternal, accessibleClientIds, defaultClientId, canWriteSales } = useAuth();

  // ── visible clients ───────────────────────────────────────────────────────
  const visibleClients = useMemo(
    () => (isInternal ? clients : clients.filter((c) => accessibleClientIds.includes(c.id))),
    [accessibleClientIds, clients, isInternal],
  );
  const activeVisibleClients = useMemo(
    () => visibleClients.filter((c) => c.status === 'active'),
    [visibleClients],
  );
  const visibleClientIds = useMemo(
    () => new Set(visibleClients.map((c) => c.id)),
    [visibleClients],
  );
  const clientMap = useMemo(
    () => new Map(visibleClients.map((c) => [c.id, c])),
    [visibleClients],
  );
  const canSelectAllClients = isInternal || visibleClients.length > 1;

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedClient, setSelectedClient] = useState(
    !isInternal && defaultClientId ? defaultClientId : 'all',
  );
  const [selectedPeriod, setSelectedPeriod] = useState<string | 'all' | null>(null);
  const [tableOpen, setTableOpen] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [quickClientId, setQuickClientId] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickDate, setQuickDate] = useState(today);
  const [quickAdding, setQuickAdding] = useState(false);
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; isError: boolean } | null>(null);

  // ── data: single query scoped by access control (not UI selection) ─────────
  // For internal users accessQueryId=undefined loads ALL clients at once.
  // UI-selection filtering happens in memory below to avoid extra round-trips.
  const accessQueryId =
    !isInternal && !canSelectAllClients
      ? (defaultClientId ?? EMPTY_SCOPE)
      : undefined;

  const { sales, addSale, removeSale, loading: salesLoading } = useDailySales(
    { clientId: accessQueryId, days: 365 },
  );
  const { rows: allCampaignRows } = useCampaignSummary(accessQueryId, 365);

  // ── in-memory filter by UI-selected client ────────────────────────────────
  const selectedClientId = selectedClient === 'all' ? undefined : selectedClient;

  const scopedSales = useMemo(
    () => (isInternal ? sales : sales.filter((s) => visibleClientIds.has(s.client_id))),
    [isInternal, sales, visibleClientIds],
  );
  const clientFilteredSales = useMemo(
    () =>
      selectedClientId
        ? scopedSales.filter((s) => s.client_id === selectedClientId)
        : scopedSales,
    [scopedSales, selectedClientId],
  );

  const filteredCampaignRows = useMemo(
    () =>
      selectedClientId
        ? allCampaignRows.filter((r) => r.client_id === selectedClientId)
        : allCampaignRows,
    [allCampaignRows, selectedClientId],
  );
  const campaignByMonth = useMemo(
    () => aggregateCampaignMetricsByMonth(filteredCampaignRows),
    [filteredCampaignRows],
  );

  // ── available periods: union of campaign months + sales months ────────────
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    campaignByMonth.forEach((m) => set.add(m.month));
    clientFilteredSales.forEach((s) => set.add(s.date.slice(0, 7)));
    return [...set].sort();
  }, [campaignByMonth, clientFilteredSales]);

  const activePeriod = selectedPeriod ?? availableMonths[availableMonths.length - 1] ?? '';

  // ── period-filtered data ──────────────────────────────────────────────────
  const periodSales = useMemo(() => {
    if (activePeriod === 'all' || activePeriod === '') return clientFilteredSales;
    return clientFilteredSales.filter((s) => s.date.startsWith(activePeriod));
  }, [clientFilteredSales, activePeriod]);

  const periodSalesTotal = useMemo(() => sumSales(periodSales).total, [periodSales]);
  const salesCount = periodSales.length;

  const periodCampaignKpi = useMemo(() => {
    if (campaignByMonth.length === 0) return null;
    if (activePeriod === 'all' || activePeriod === '') {
      return sumCampaignMonthAggregates(campaignByMonth, 'all');
    }
    return campaignByMonth.find((m) => m.month === activePeriod) ?? null;
  }, [campaignByMonth, activePeriod]);

  const messages = periodCampaignKpi?.messages ?? 0;
  const spend = periodCampaignKpi?.spend ?? 0;
  const closureRate = messages > 0 ? (salesCount / messages) * 100 : null;
  const roas = spend > 0 ? periodSalesTotal / spend : null;

  // ── chart: sales by month ─────────────────────────────────────────────────
  const salesByMonth = useMemo(() => {
    const map = new Map<string, number>();
    clientFilteredSales.forEach((s) => {
      const mk = s.date.slice(0, 7);
      map.set(mk, (map.get(mk) ?? 0) + s.total_sales);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }));
  }, [clientFilteredSales]);

  // ── records section ───────────────────────────────────────────────────────
  const recordsLabel =
    activePeriod === 'all' || activePeriod === ''
      ? `REGISTROS — AÑO COMPLETO (${salesCount})`
      : `REGISTROS — ${getMonthLabel(activePeriod).toUpperCase()} (${salesCount})`;

  const orderedPeriodSales = useMemo(
    () => [...periodSales].sort((a, b) => b.date.localeCompare(a.date)),
    [periodSales],
  );
  const canWriteAnySales = isInternal || visibleClients.some((c) => canWriteSales(c.id));

  // ── handlers ──────────────────────────────────────────────────────────────
  async function handleQuickAdd() {
    if (!quickClientId || !quickAmount || !quickDate) return;
    const amount = parseFloat(quickAmount.replace(/[^\d.]/g, ''));
    if (!amount || amount <= 0) return;
    setQuickAdding(true);
    setFeedback(null);
    const result = await addSale({
      client_id: quickClientId,
      date: quickDate,
      total_sales: amount,
      new_client_sales: 0,
      repeat_sales: 0,
      physical_store_sales: 0,
      online_sales: 0,
      observations: null,
      status: 'submitted',
    });
    setQuickAdding(false);
    if (result.error) {
      setFeedback({ msg: result.error, isError: true });
    } else {
      setQuickAmount('');
      setFeedback({ msg: 'Venta registrada.', isError: false });
      setTimeout(() => setFeedback(null), 3000);
    }
  }

  async function handleSaveEdit(saleClientId: string, saleDate: string) {
    const amount = parseFloat(editAmount.replace(/[^\d.]/g, ''));
    if (!amount || amount <= 0) return;
    const result = await addSale({
      client_id: saleClientId,
      date: saleDate,
      total_sales: amount,
      new_client_sales: 0,
      repeat_sales: 0,
      physical_store_sales: 0,
      online_sales: 0,
      observations: null,
      status: 'submitted',
    });
    if (!result.error) setEditingSaleId(null);
  }

  async function handleDelete(saleId: string) {
    const sale = orderedPeriodSales.find((s) => s.id === saleId);
    if (!sale) return;
    const client = clientMap.get(sale.client_id);
    const ok = window.confirm(
      `Eliminar registro del ${shortDate(sale.date)} para ${client?.name ?? 'cliente'}?`,
    );
    if (!ok) return;
    setDeletingSaleId(saleId);
    await removeSale(sale);
    setDeletingSaleId(null);
  }

  // ── KPI cards ─────────────────────────────────────────────────────────────
  const kpiCards = [
    {
      icon: <DollarSign size={15} />,
      label: 'VENTAS DEL PERÍODO',
      value: formatCop(periodSalesTotal),
      sub: `${salesCount} ${salesCount === 1 ? 'registro' : 'registros'}`,
      muted: false,
    },
    {
      icon: <MessageCircle size={15} />,
      label: 'MENSAJES',
      value: messages > 0 ? formatNumber(messages) : '—',
      sub: 'Conversaciones Meta Ads',
      muted: messages === 0,
    },
    {
      icon: <Percent size={15} />,
      label: 'TASA DE CIERRE',
      value: closureRate != null ? `${closureRate.toFixed(1)}%` : '—',
      sub:
        closureRate != null
          ? closureRate >= 10
            ? '✓ Saludable ≥ 10%'
            : closureRate >= 8
              ? '⚠ Mejorable'
              : '✗ Revisar proceso comercial'
          : 'Sin mensajes en período',
      muted: closureRate == null,
    },
    {
      icon: <TrendingUp size={15} />,
      label: 'ROAS',
      value: roas != null ? `${roas.toFixed(2)}x` : '—',
      sub: roas != null ? 'Ventas / Inversión ads' : 'Sin inversión registrada',
      muted: roas == null,
    },
  ];

  return (
    <div className="page-content">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <TrendingUp
              size={20}
              style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }}
            />
            Ventas
          </h1>
          <p className="number-label" style={{ marginTop: 4, letterSpacing: '0.08em' }}>
            REGISTRO DE VENTAS DIARIAS
          </p>
        </div>
      </div>

      {/* ── Section 1: Client + Period selectors ── */}
      <div className="metrics-filter-row">
        {canSelectAllClients ? (
          <select
            className="form-input metrics-client-select"
            value={selectedClient}
            onChange={(e) => {
              setSelectedClient(e.target.value);
              setSelectedPeriod(null);
            }}
            disabled={clientsLoading}
          >
            <option value="all">Todos los clientes</option>
            {activeVisibleClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="metrics-client-label">
            {visibleClients[0]?.name ?? 'Sin empresa'}
          </span>
        )}

        {availableMonths.length > 0 && (
          <div className="filter-row" style={{ flexWrap: 'wrap', gap: 4 }}>
            {availableMonths.map((m) => (
              <button
                key={m}
                className={`filter-chip ${activePeriod === m ? 'active' : ''}`}
                onClick={() => setSelectedPeriod(m)}
              >
                {shortMonth(m)}
              </button>
            ))}
            <button
              className={`filter-chip ${activePeriod === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedPeriod('all')}
            >
              Total año
            </button>
          </div>
        )}
      </div>

      {/* ── Section 2: KPI Cards ── */}
      <div className="metrics-kpi-grid">
        {salesLoading && periodSales.length === 0 ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-card" style={{ height: 90, borderRadius: 12 }} />
          ))
        ) : kpiCards.map((card, i) => (
          <motion.div
            key={card.label}
            className="card-glass metrics-kpi-card"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 } as Transition}
          >
            <div className="metrics-kpi-header">
              <span className={`metrics-kpi-icon ${card.muted ? 'is-muted' : ''}`}>
                {card.icon}
              </span>
              <span className="number-label">{card.label}</span>
            </div>
            <strong className={`font-display metrics-kpi-value ${card.muted ? 'is-muted' : ''}`}>
              {card.value}
            </strong>
            <span className="metrics-kpi-sub">{card.sub}</span>
          </motion.div>
        ))}
      </div>

      {/* ── Section 3: Records (collapsible) ── */}
      <div className="card-glass" style={{ marginBottom: 12, overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setTableOpen((o) => !o)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '14px 20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'inherit',
          }}
        >
          <span className="number-label" style={{ fontSize: '0.64rem', letterSpacing: '0.1em' }}>
            {recordsLabel}
          </span>
          {tableOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {tableOpen && (
          <div style={{ padding: '0 20px 16px' }}>
            {feedback && (
              <p
                style={{
                  fontSize: '0.78rem',
                  marginBottom: 10,
                  color: feedback.isError ? 'hsl(0,84%,65%)' : 'hsl(145,100%,45%)',
                }}
              >
                {feedback.msg}
              </p>
            )}

            {salesLoading && orderedPeriodSales.length === 0 ? (
              <p className="empty-note">Cargando ventas...</p>
            ) : orderedPeriodSales.length === 0 ? (
              <p className="empty-note">No hay registros para este período.</p>
            ) : (
              <div className="table-wrap">
                <table className="sales-simple-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th className="num-col">Venta</th>
                      {canWriteAnySales && <th className="actions-col" />}
                    </tr>
                  </thead>
                  <tbody>
                    {orderedPeriodSales.map((sale) => {
                      const client = clientMap.get(sale.client_id);
                      const isEditing = editingSaleId === sale.id;
                      return (
                        <tr key={sale.id}>
                          <td style={{ fontSize: '0.8rem', color: 'hsl(215,15%,55%)' }}>
                            {shortDate(sale.date)}
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>{client?.name ?? '—'}</td>
                          <td className="num-col">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                autoFocus
                                style={{
                                  width: 120,
                                  padding: '4px 8px',
                                  fontSize: '0.82rem',
                                  background: 'rgba(255,255,255,0.06)',
                                  border: '1px solid hsl(180 100% 50% / 0.3)',
                                  borderRadius: 6,
                                  color: 'inherit',
                                }}
                              />
                            ) : (
                              <span
                                style={{
                                  fontVariantNumeric: 'tabular-nums',
                                  fontSize: '0.82rem',
                                }}
                              >
                                {formatCopFull(sale.total_sales)}
                              </span>
                            )}
                          </td>
                          {canWriteAnySales && (
                            <td className="actions-col" style={{ textAlign: 'right' }}>
                              {canWriteSales(sale.client_id) ? (
                                isEditing ? (
                                  <span style={{ display: 'inline-flex', gap: 4 }}>
                                    <button
                                      type="button"
                                      title="Guardar"
                                      onClick={() =>
                                        void handleSaveEdit(sale.client_id, sale.date)
                                      }
                                      style={actionBtn('cyan')}
                                    >
                                      ✓
                                    </button>
                                    <button
                                      type="button"
                                      title="Cancelar"
                                      onClick={() => setEditingSaleId(null)}
                                      style={actionBtn('muted')}
                                    >
                                      ✕
                                    </button>
                                  </span>
                                ) : (
                                  <span style={{ display: 'inline-flex', gap: 4 }}>
                                    <button
                                      type="button"
                                      title="Editar"
                                      onClick={() => {
                                        setEditingSaleId(sale.id);
                                        setEditAmount(String(sale.total_sales));
                                      }}
                                      style={actionBtn('muted')}
                                    >
                                      <Pencil size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      title="Eliminar"
                                      disabled={deletingSaleId === sale.id}
                                      onClick={() => void handleDelete(sale.id)}
                                      style={actionBtn('red')}
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </span>
                                )
                              ) : (
                                <span
                                  style={{ fontSize: '0.7rem', color: 'hsl(215,15%,38%)' }}
                                >
                                  —
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Quick-add row */}
            {canWriteAnySales && (
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 14,
                  alignItems: 'center',
                  paddingTop: 12,
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <select
                  value={quickClientId}
                  onChange={(e) => setQuickClientId(e.target.value)}
                  style={QUICK_INPUT}
                  disabled={clientsLoading}
                >
                  <option value="">Cliente</option>
                  {activeVisibleClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={quickDate}
                  onChange={(e) => setQuickDate(e.target.value)}
                  style={{ ...QUICK_INPUT, flex: 'none', width: 130 }}
                />
                <input
                  type="number"
                  placeholder="Monto"
                  value={quickAmount}
                  onChange={(e) => setQuickAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleQuickAdd();
                  }}
                  style={{ ...QUICK_INPUT, flex: 'none', width: 120 }}
                />
                <button
                  type="button"
                  title="Agregar venta"
                  onClick={() => void handleQuickAdd()}
                  disabled={!quickClientId || !quickAmount || quickAdding}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 30,
                    height: 30,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: 'hsl(180,100%,45%)',
                    color: '#000',
                    fontWeight: 700,
                    flexShrink: 0,
                    opacity: !quickClientId || !quickAmount || quickAdding ? 0.4 : 1,
                  }}
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Section 4: Trend Chart ── */}
      {salesByMonth.length > 0 && (
        <div
          style={{
            background: 'rgba(6,10,18,0.85)',
            border: '1px solid hsl(180 100% 50% / 0.12)',
            borderRadius: 12,
            padding: '20px 16px 14px',
            marginBottom: 24,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle background glow */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 12,
            background: 'radial-gradient(ellipse 60% 40% at 50% 100%, hsl(180 100% 50% / 0.04) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, position: 'relative' }}>
            <span className="number-label" style={{ fontSize: '0.6rem', color: 'hsl(215,15%,42%)', letterSpacing: '0.12em' }}>
              TENDENCIA DE VENTAS
            </span>
            {salesByMonth.length > 0 && (
              <span style={{ fontSize: '0.68rem', color: 'hsl(180,100%,55%)', fontFamily: 'JetBrains Mono' }}>
                {formatCopCompact(Math.max(...salesByMonth.map((m) => m.total)))} máx
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={salesByMonth} margin={{ top: 12, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salesLineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(180,100%,55%)" />
                  <stop offset="100%" stopColor="hsl(280,80%,65%)" />
                </linearGradient>
                <linearGradient id="salesAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(180,100%,55%)" stopOpacity={0.22} />
                  <stop offset="60%" stopColor="hsl(240,80%,60%)" stopOpacity={0.07} />
                  <stop offset="100%" stopColor="hsl(280,80%,65%)" stopOpacity={0} />
                </linearGradient>
                <filter id="salesGlow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid
                strokeDasharray="1 8"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tickFormatter={shortMonth}
                tick={{ fontSize: 10, fill: 'hsl(215,15%,40%)', fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis hide />
              <Tooltip
                formatter={(v) => [formatCopFull(v as number), 'Ventas']}
                labelFormatter={(label: unknown) => shortMonth(String(label))}
                contentStyle={{
                  background: 'rgba(8,12,22,0.92)',
                  border: '1px solid hsl(180 100% 50% / 0.25)',
                  borderRadius: 10,
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 4px 24px hsl(180 100% 50% / 0.12)',
                }}
                cursor={{ stroke: 'hsl(180 100% 50% / 0.3)', strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="url(#salesLineGrad)"
                strokeWidth={2.5}
                fill="url(#salesAreaGrad)"
                filter="url(#salesGlow)"
                dot={(props) => {
                  const { cx, cy, payload } = props as { cx: number; cy: number; payload: { month: string } };
                  const isActive = payload.month === activePeriod;
                  return (
                    <circle
                      key={payload.month}
                      cx={cx}
                      cy={cy}
                      r={isActive ? 6 : 4}
                      fill={isActive ? 'hsl(180,100%,65%)' : 'hsl(180,100%,55%)'}
                      stroke={isActive ? 'hsl(180,100%,85%)' : 'hsl(180,100%,30%)'}
                      strokeWidth={isActive ? 2 : 1.5}
                      style={{ filter: `drop-shadow(0 0 ${isActive ? 8 : 4}px hsl(180,100%,55%))` }}
                    />
                  );
                }}
                activeDot={{ r: 7, fill: 'hsl(180,100%,65%)', stroke: 'hsl(180,100%,85%)', strokeWidth: 2, style: { filter: 'drop-shadow(0 0 8px hsl(180,100%,55%))' } }}
                animationDuration={900}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
