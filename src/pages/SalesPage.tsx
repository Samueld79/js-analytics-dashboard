import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, TrendingUp } from 'lucide-react';
import { SalesModal } from '../components/SalesModal';
import { useDashboard } from '../hooks/useDashboard';
import { useDailySales } from '../hooks/useDailySales';
import type { Client } from '../lib/supabase';
import { formatCop, formatDate, sumOperatingKpis } from '../lib/utils';

export function SalesPage() {
  const { clients, dailyKpis, monthlyKpis, reload: reloadDashboard } = useDashboard(30);
  const { sales, addSale, reload: reloadSales } = useDailySales(undefined, 90);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const yesterday = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  }, []);

  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  const totals30d = sumOperatingKpis(dailyKpis);

  const latestSalesByClient = useMemo(() => {
    const latest = new Map<string, (typeof sales)[number]>();
    const ordered = [...sales].sort((a, b) => b.date.localeCompare(a.date));

    for (const sale of ordered) {
      if (!latest.has(sale.client_id)) latest.set(sale.client_id, sale);
    }

    return latest;
  }, [sales]);

  const rows = clients
    .filter((client) =>
      client.name.toLowerCase().includes(search.toLowerCase()) ||
      (client.niche ?? '').toLowerCase().includes(search.toLowerCase()),
    )
    .map((client) => {
      const monthRow =
        monthlyKpis.find(
          (row) => row.client_id === client.id && row.month.startsWith(currentMonthPrefix),
        ) ?? null;
      const yesterdayRow =
        dailyKpis.find((row) => row.client_id === client.id && row.date === yesterday) ?? null;
      const latestSale = latestSalesByClient.get(client.id) ?? null;
      const pendingYesterday = client.status === 'active' && (yesterdayRow?.total_sales ?? 0) <= 0;

      return {
        client,
        monthRow,
        yesterdayRow,
        latestSale,
        pendingYesterday,
      };
    });

  const pendingClients = rows.filter((row) => row.pendingYesterday).length;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title"><TrendingUp size={20} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />Ventas</h1>
          <p className="page-subtitle">Registro diario y seguimiento operativo por cliente</p>
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
        <SalesKpi label="Ventas 30d" value={formatCop(totals30d.total_sales)} />
        <SalesKpi label="Nuevo cliente 30d" value={formatCop(totals30d.new_client_sales)} />
        <SalesKpi label="Recompra 30d" value={formatCop(totals30d.repeat_sales)} />
        <SalesKpi
          label="Clientes pendientes ayer"
          value={String(pendingClients)}
          highlight={pendingClients > 0 ? 'amber' : 'green'}
        />
      </div>

      <div className="card section-block">
        <div className="section-heading"><h2>Seguimiento diario</h2></div>
        {rows.length === 0 ? (
          <p className="empty-note">No hay clientes o ventas registradas todavía.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Última carga</th>
                  <th className="num-col">Ventas mes</th>
                  <th className="num-col">Ventas ayer</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ client, latestSale, monthRow, yesterdayRow, pendingYesterday }) => (
                  <tr key={client.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <strong>{client.name}</strong>
                        <span className="text-muted">{client.niche ?? 'Sin nicho'}</span>
                      </div>
                    </td>
                    <td>{latestSale ? formatDate(latestSale.date) : '—'}</td>
                    <td className="num-col">{formatCop(monthRow?.total_sales ?? 0)}</td>
                    <td className="num-col">{formatCop(yesterdayRow?.total_sales ?? 0)}</td>
                    <td>
                      <span className={`status-pill status-${pendingYesterday ? 'amber' : 'green'}`}>
                        {pendingYesterday ? 'Pendiente' : 'Al día'}
                      </span>
                    </td>
                    <td>
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
                ))}
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
