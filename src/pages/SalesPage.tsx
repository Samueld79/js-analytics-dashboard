import { useMemo, useState } from 'react';
import { Plus, Trash2, TrendingUp } from 'lucide-react';
import { SalesModal } from '../components/SalesModal';
import { useClients } from '../hooks/useClients';
import { useDailySales } from '../hooks/useDailySales';
import type { Client } from '../lib/supabase';
import {
  formatCop,
  formatDate,
  getDateKey,
  getMonthStartKey,
  getYearStartKey,
  getYesterdayKey,
  isDateWithinRange,
  sumSales,
} from '../lib/utils';
import { getMonthLabel } from '../utils/monthLabel';

type SalesFilterKey = 'today' | 'yesterday' | 'last7' | 'month' | 'year' | 'custom';

const FILTER_OPTIONS: Array<{ key: SalesFilterKey; label: string }> = [
  { key: 'today', label: 'Hoy' },
  { key: 'yesterday', label: 'Ayer' },
  { key: 'last7', label: 'Últimos 7 días' },
  { key: 'month', label: 'Mes actual' },
  { key: 'year', label: 'Año actual' },
  { key: 'custom', label: 'Rango personalizado' },
];

function sortByDateDesc(left: { date: string }, right: { date: string }) {
  return right.date.localeCompare(left.date);
}

function getRangeBounds(filter: SalesFilterKey, today: string, customFrom: string, customTo: string) {
  if (filter === 'today') return { startDate: today, endDate: today, label: 'Hoy' };
  if (filter === 'yesterday') {
    const yesterday = getYesterdayKey();
    return { startDate: yesterday, endDate: yesterday, label: 'Ayer' };
  }
  if (filter === 'last7') {
    const startDate = getDateKey(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
    return { startDate, endDate: today, label: 'Últimos 7 días' };
  }
  if (filter === 'month') {
    return { startDate: getMonthStartKey(), endDate: today, label: `Mes actual · ${getMonthLabel(today)}` };
  }
  if (filter === 'year') {
    const year = today.slice(0, 4);
    return { startDate: getYearStartKey(), endDate: today, label: `Año actual · ${year}` };
  }

  return {
    startDate: customFrom || undefined,
    endDate: customTo || undefined,
    label:
      customFrom && customTo
        ? `Rango personalizado · ${formatDate(customFrom)} a ${formatDate(customTo)}`
        : 'Rango personalizado',
  };
}

export function SalesPage() {
  const { clients, loading: clientsLoading } = useClients();
  const { sales, addSale, removeSale, loading: salesLoading } = useDailySales(undefined, 1200);
  const [search, setSearch] = useState('');
  const [filterKey, setFilterKey] = useState<SalesFilterKey>('month');
  const [quickClientId, setQuickClientId] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const today = getDateKey();
  const monthStart = getMonthStartKey();
  const yearStart = getYearStartKey();
  const [customFrom, setCustomFrom] = useState(monthStart);
  const [customTo, setCustomTo] = useState(today);

  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const orderedSales = useMemo(() => [...sales].sort(sortByDateDesc), [sales]);
  const todaySales = useMemo(
    () => orderedSales.filter((sale) => isDateWithinRange(sale.date, today, today)),
    [orderedSales, today],
  );
  const monthSales = useMemo(
    () => orderedSales.filter((sale) => isDateWithinRange(sale.date, monthStart, today)),
    [monthStart, orderedSales, today],
  );
  const yearSales = useMemo(
    () => orderedSales.filter((sale) => isDateWithinRange(sale.date, yearStart, today)),
    [orderedSales, today, yearStart],
  );

  const activeRange = useMemo(
    () => getRangeBounds(filterKey, today, customFrom, customTo),
    [customFrom, customTo, filterKey, today],
  );

  const filteredSales = useMemo(() => {
    const term = search.trim().toLowerCase();

    return orderedSales.filter((sale) => {
      const client = clientMap.get(sale.client_id);
      const matchesSearch =
        !term ||
        client?.name.toLowerCase().includes(term) ||
        client?.niche?.toLowerCase().includes(term) ||
        sale.date.includes(term);

      return (
        matchesSearch &&
        isDateWithinRange(sale.date, activeRange.startDate, activeRange.endDate)
      );
    });
  }, [activeRange.endDate, activeRange.startDate, clientMap, orderedSales, search]);

  const filteredTotal = useMemo(() => sumSales(filteredSales).total, [filteredSales]);
  const todayTotal = useMemo(() => sumSales(todaySales).total, [todaySales]);
  const monthTotal = useMemo(() => sumSales(monthSales).total, [monthSales]);
  const yearTotal = useMemo(() => sumSales(yearSales).total, [yearSales]);
  const currentMonthLabel = getMonthLabel(today);
  const registerClient = selectedClient;

  async function handleDeleteSale(saleId: string) {
    const sale = filteredSales.find((entry) => entry.id === saleId);
    if (!sale) return;

    const client = clientMap.get(sale.client_id);
    const confirmed = window.confirm(
      `Eliminar el registro de ventas del ${formatDate(sale.date)} para ${client?.name ?? 'este cliente'}? Esta acción recalcula los KPIs del periodo.`,
    );

    if (!confirmed) return;

    setDeletingSaleId(sale.id);
    setActionFeedback(null);
    setActionError(null);

    const result = await removeSale(sale);
    if (result.error) {
      setActionError(result.error);
    } else {
      setActionFeedback('Registro eliminado. Los KPIs y listados ya se recalcularon.');
    }

    setDeletingSaleId(null);
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <TrendingUp
              size={20}
              style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }}
            />
            Ventas
          </h1>
          <p className="page-subtitle">
            Registro simple sobre ventas diarias · solo fecha y venta
          </p>
        </div>
      </div>

      <div className="card section-block period-toolbar-card">
        <div className="period-toolbar">
          <div className="period-toolbar-copy">
            <div className="section-heading">
              <h2>Captura simple</h2>
            </div>
            <p className="source-note">
              Esta fase registra solo fecha y venta. Los demás campos de ventas diarias se guardan
              en cero para reducir fricción operativa.
            </p>
            <div className="period-chip-row">
              <span className="meta-chip">Mes actual · {currentMonthLabel}</span>
              <span className="meta-chip">Año actual · {today.slice(0, 4)}</span>
              <span className="meta-chip">Fuente oficial · ventas diarias</span>
            </div>
          </div>

          <div className="sales-quick-actions">
            <label className="form-field">
              <span className="form-label">Cliente para registrar</span>
              <select
                className="form-input"
                value={quickClientId}
                onChange={(event) => setQuickClientId(event.target.value)}
              >
                <option value="">Selecciona un cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn-primary"
              disabled={!quickClientId || clientsLoading}
              onClick={() => {
                const nextClient = clients.find((client) => client.id === quickClientId) ?? null;
                setSelectedClient(nextClient);
              }}
            >
              <Plus size={14} />
              Registrar venta
            </button>
          </div>
        </div>
      </div>

      <div className="kpi-row">
        <SalesKpi label="Ventas de hoy" value={formatCop(todayTotal)} />
        <SalesKpi label="Ventas del mes actual" value={formatCop(monthTotal)} />
        <SalesKpi label="Ventas del año actual" value={formatCop(yearTotal)} />
        <SalesKpi label="Registros del mes actual" value={String(monthSales.length)} />
        <SalesKpi label="Registros del año actual" value={String(yearSales.length)} />
      </div>

      <div className="card section-block">
        <div className="section-heading">
          <h2>Filtro de ventas</h2>
        </div>
        <div className="sales-filter-layout">
          <div className="sales-filter-chip-row">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.key}
                className={`filter-chip-button ${filterKey === option.key ? 'active' : ''}`}
                onClick={() => setFilterKey(option.key)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="sales-filter-tools">
            {filterKey === 'custom' && (
              <div className="sales-custom-range">
                <label className="form-field">
                  <span className="form-label">Desde</span>
                  <input
                    className="form-input"
                    type="date"
                    value={customFrom}
                    onChange={(event) => setCustomFrom(event.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Hasta</span>
                  <input
                    className="form-input"
                    type="date"
                    value={customTo}
                    onChange={(event) => setCustomTo(event.target.value)}
                  />
                </label>
              </div>
            )}

            <label className="form-field sales-search-field">
              <span className="form-label">Buscar</span>
              <input
                className="search-input"
                placeholder="Cliente o fecha..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="period-chip-row">
          <span className="meta-chip">{activeRange.label}</span>
          <span className="meta-chip">{filteredSales.length} registros visibles</span>
          <span className="meta-chip">Total visible {formatCop(filteredTotal)}</span>
        </div>
      </div>

      <div className="card section-block">
        <div className="section-heading">
          <h2>Registros de ventas</h2>
        </div>
        <p className="source-note">
          Vista simple del rango seleccionado. En desktop se muestra como tabla y en móvil baja a
          cards responsivas.
        </p>
        {!actionError && actionFeedback && <p className="history-success">{actionFeedback}</p>}
        {actionError && <p className="sales-feedback-error">{actionError}</p>}
        {salesLoading ? (
          <p className="empty-note">Cargando ventas...</p>
        ) : filteredSales.length === 0 ? (
          <p className="empty-note">No hay ventas para el filtro activo.</p>
        ) : (
          <div className="table-wrap responsive-card-table">
            <table className="sales-simple-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th className="num-col">Venta</th>
                  <th className="actions-col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => {
                  const client = clientMap.get(sale.client_id);

                  return (
                    <tr key={sale.id}>
                      <td data-label="Fecha">{formatDate(sale.date)}</td>
                      <td data-label="Cliente">
                        <div className="table-primary-cell">
                          <strong>{client?.name ?? 'Cliente'}</strong>
                          <span className="table-secondary-note">{client?.niche ?? 'Sin nicho'}</span>
                        </div>
                      </td>
                      <td className="num-col" data-label="Venta">
                        {formatCop(sale.total_sales)}
                      </td>
                      <td className="actions-col" data-label="Acciones">
                        <button
                          type="button"
                          className="table-action-button danger"
                          disabled={deletingSaleId === sale.id}
                          onClick={() => void handleDeleteSale(sale.id)}
                        >
                          <Trash2 size={14} />
                          {deletingSaleId === sale.id ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {registerClient && (
        <SalesModal
          clientId={registerClient.id}
          clientName={registerClient.name}
          onClose={() => setSelectedClient(null)}
          onSave={async (data) => {
            const result = await addSale(data);
            if (!result.error) {
              setSelectedClient(null);
            }
            return result;
          }}
        />
      )}
    </div>
  );
}

function SalesKpi({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="kpi-box">
      <div className="kpi-box-label">{label}</div>
      <div className="kpi-box-value">{value}</div>
    </div>
  );
}
