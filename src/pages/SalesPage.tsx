import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, TrendingUp } from 'lucide-react';
import { MonthSelector } from '../components/MonthSelector';
import { SalesModal } from '../components/SalesModal';
import { useDashboard } from '../hooks/useDashboard';
import { useDailySales } from '../hooks/useDailySales';
import type { Client } from '../lib/supabase';
import { formatCop, formatDate, formatRoas, sumSales } from '../lib/utils';
import { getMonthLabel, getMonthKey, listAvailableMonthKeys } from '../utils/monthLabel';

export function SalesPage() {
  const { clients, dailyKpis, monthlyKpis, reload: reloadDashboard } = useDashboard(30);
  const { sales, addSale, reload: reloadSales } = useDailySales(undefined, 400);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedMonth, setSelectedMonth] = useState('');

  const yesterday = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  }, []);

  const availableMonths = useMemo(
    () => listAvailableMonthKeys([...sales.map((sale) => sale.date), ...monthlyKpis.map((row) => row.month)]),
    [monthlyKpis, sales],
  );
  const fallbackMonth = availableMonths[0] ?? new Date().toISOString().slice(0, 7);

  useEffect(() => {
    if (!selectedMonth) {
      setSelectedMonth(fallbackMonth);
      return;
    }

    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, fallbackMonth, selectedMonth]);

  const activeMonth = selectedMonth || fallbackMonth;
  const selectedMonthLabel = getMonthLabel(activeMonth);
  const monthSales = useMemo(
    () => sales.filter((sale) => getMonthKey(sale.date) === activeMonth),
    [activeMonth, sales],
  );
  const monthTotals = sumSales(monthSales);

  const latestSalesByClient = useMemo(() => {
    const latest = new Map<string, (typeof sales)[number]>();
    const ordered = [...sales].sort((a, b) => b.date.localeCompare(a.date));

    for (const sale of ordered) {
      if (!latest.has(sale.client_id)) latest.set(sale.client_id, sale);
    }

    return latest;
  }, [sales]);

  const rows = clients
    .filter(
      (client) =>
        client.name.toLowerCase().includes(search.toLowerCase()) ||
        (client.niche ?? '').toLowerCase().includes(search.toLowerCase()),
    )
    .map((client) => {
      const monthlyRow =
        monthlyKpis.find(
          (row) => row.client_id === client.id && getMonthKey(row.month) === activeMonth,
        ) ?? null;
      const clientMonthSales = monthSales.filter((sale) => sale.client_id === client.id);
      const salesTotals = sumSales(clientMonthSales);
      const yesterdayRow =
        dailyKpis.find((row) => row.client_id === client.id && row.date === yesterday) ?? null;
      const latestSale = latestSalesByClient.get(client.id) ?? null;
      const pendingYesterday = client.status === 'active' && (yesterdayRow?.total_sales ?? 0) <= 0;

      return {
        client,
        latestSale,
        pendingYesterday,
        spend: monthlyRow?.spend ?? 0,
        totalSales: salesTotals.total,
        newClientSales: salesTotals.newClient,
        repeatSales: salesTotals.repeat,
        realRoas:
          monthlyRow?.real_roas ?? ((monthlyRow?.spend ?? 0) > 0 ? salesTotals.total / (monthlyRow?.spend ?? 0) : 0),
      };
    });

  const pendingClients = rows.filter((row) => row.pendingYesterday).length;
  const clientsWithSales = rows.filter((row) => row.totalSales > 0).length;

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
            Ventas reportadas del mes seleccionado · {selectedMonthLabel}
          </p>
        </div>
      </div>

      <div className="card section-block period-toolbar-card">
        <div className="period-toolbar">
          <div className="period-toolbar-copy">
            <div className="section-heading">
              <h2>Periodo visible</h2>
            </div>
            <p className="source-note">
              Esta vista usa ventas reportadas en `daily_sales` para el mes seleccionado. El estado
              "pendiente ayer" sigue siendo operativo y actual.
            </p>
            <div className="period-chip-row">
              <span className="meta-chip">{selectedMonthLabel}</span>
              <span className="meta-chip">Ventas reportadas</span>
              <span className="meta-chip">{clientsWithSales} clientes con ventas en el mes</span>
            </div>
          </div>
          <MonthSelector
            label="Mes visible"
            value={activeMonth}
            options={availableMonths.length > 0 ? availableMonths : [fallbackMonth]}
            helper="Se listan meses con ventas reportadas o con consolidado mensual disponible."
            onChange={setSelectedMonth}
          />
        </div>
      </div>

      <div className="search-bar-wrap">
        <input
          className="search-input"
          placeholder="Buscar cliente..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="kpi-row">
        <SalesKpi label="Ventas del mes" value={formatCop(monthTotals.total)} />
        <SalesKpi label="Nuevo cliente" value={formatCop(monthTotals.newClient)} />
        <SalesKpi label="Recompra" value={formatCop(monthTotals.repeat)} />
        <SalesKpi label="Clientes con ventas" value={String(clientsWithSales)} />
        <SalesKpi
          label="Clientes pendientes ayer"
          value={String(pendingClients)}
          highlight={pendingClients > 0 ? 'amber' : 'green'}
        />
      </div>

      <div className="card section-block">
        <div className="section-heading">
          <h2>Seguimiento por cliente</h2>
        </div>
        <p className="source-note">
          Ventas del mes seleccionado con referencia a Ads del mismo mes cuando existan métricas.
        </p>
        {rows.length === 0 ? (
          <p className="empty-note">No hay clientes o ventas registradas todavía.</p>
        ) : (
          <div className="table-wrap responsive-card-table">
            <table className="sales-tracking-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Última carga</th>
                  <th className="num-col">Ventas mes</th>
                  <th className="num-col">Nuevo</th>
                  <th className="num-col">Recompra</th>
                  <th className="num-col">Ads mes</th>
                  <th className="num-col">ROAS Real</th>
                  <th>Estado reciente</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(
                  ({ client, latestSale, totalSales, newClientSales, repeatSales, spend, realRoas, pendingYesterday }) => (
                    <tr key={client.id}>
                      <td data-label="Cliente">
                        <div className="table-primary-cell">
                          <strong>{client.name}</strong>
                          <span className="table-secondary-note">{client.niche ?? 'Sin nicho'}</span>
                        </div>
                      </td>
                      <td data-label="Última carga">{latestSale ? formatDate(latestSale.date) : '—'}</td>
                      <td className="num-col" data-label="Ventas mes">{formatCop(totalSales)}</td>
                      <td className="num-col" data-label="Nuevo">{formatCop(newClientSales)}</td>
                      <td className="num-col" data-label="Recompra">{formatCop(repeatSales)}</td>
                      <td className="num-col" data-label="Ads mes">{formatCop(spend)}</td>
                      <td
                        data-label="ROAS Real"
                        className={`num-col ${
                          realRoas >= 3 ? 'text-green' : realRoas >= 2 ? 'text-amber' : 'text-red'
                        }`}
                      >
                        {spend > 0 ? formatRoas(realRoas) : '—'}
                      </td>
                      <td data-label="Estado reciente">
                        <span className={`status-pill status-${pendingYesterday ? 'amber' : 'green'}`}>
                          {pendingYesterday ? 'Pendiente ayer' : 'Al día'}
                        </span>
                      </td>
                      <td data-label="Acción">
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button className="btn-secondary" onClick={() => setSelectedClient(client)}>
                            <Plus size={14} /> Registrar
                          </button>
                          <Link to={`/clients/${client.id}`} className="btn-ghost">
                            Ver cliente
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedClient && (
        <SalesModal
          clientId={selectedClient.id}
          clientName={selectedClient.name}
          onClose={() => setSelectedClient(null)}
          onSave={async (data) => {
            const result = await addSale(data);
            if (!result.error) {
              await Promise.all([reloadSales(), reloadDashboard()]);
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
  highlight,
}: {
  label: string;
  value: string;
  highlight?: 'green' | 'amber';
}) {
  return (
    <div className="kpi-box">
      <div className="kpi-box-label">{label}</div>
      <div className={`kpi-box-value ${highlight ? `text-${highlight}` : ''}`}>{value}</div>
    </div>
  );
}
