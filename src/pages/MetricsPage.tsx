import { useState } from 'react';
import { useAdMetrics } from '../hooks/useData';
import { useClients } from '../hooks/useClients';
import { formatCop, formatNumber, formatRoas, sumMetrics } from '../lib/utils';
import { BarChart2 } from 'lucide-react';

export function MetricsPage() {
  const { clients } = useClients();
  const { metrics } = useAdMetrics(undefined, 30);
  const [selectedClient, setSelectedClient] = useState('all');

  const filtered = selectedClient === 'all' ? metrics : metrics.filter(m => m.client_id === selectedClient);
  const totals = sumMetrics(filtered);

  const byClient = clients.map(c => {
    const cm = metrics.filter(m => m.client_id === c.id);
    return { client: c, ...sumMetrics(cm) };
  }).sort((a, b) => b.roas - a.roas);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title"><BarChart2 size={20} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />Métricas Ads</h1>
          <p className="page-subtitle">Vista consolidada · Últimos 30 días</p>
        </div>
      </div>

      <div className="filter-row">
        <button onClick={() => setSelectedClient('all')} className={`filter-chip ${selectedClient === 'all' ? 'active' : ''}`}>Todos los clientes</button>
        {clients.map(c => (
          <button key={c.id} onClick={() => setSelectedClient(c.id)} className={`filter-chip ${selectedClient === c.id ? 'active' : ''}`}>{c.name}</button>
        ))}
      </div>

      <div className="kpi-row">
        <KM label="Inversión total" value={formatCop(totals.spend)} />
        <KM label="Valor compras" value={formatCop(totals.purchase_value)} />
        <KM label="ROAS promedio" value={formatRoas(totals.roas)} highlight={totals.roas >= 3 ? 'green' : totals.roas >= 2 ? 'amber' : 'red'} />
        <KM label="Mensajes" value={formatNumber(totals.messages)} />
        <KM label="CPR ponderado" value={formatCop(totals.cpr)} />
        <KM label="Leads" value={formatNumber(totals.leads)} />
        <KM label="Compras" value={formatNumber(totals.purchases)} />
        <KM label="Alcance" value={formatNumber(totals.reach)} />
      </div>

      {selectedClient === 'all' && (
        <div className="card section-block">
          <div className="section-heading"><h2>Comparativa por cliente</h2></div>
          {byClient.length === 0 ? (
            <p className="empty-note">No hay metricas registradas todavia.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th className="num-col">Inversión</th>
                    <th className="num-col">ROAS</th>
                    <th className="num-col">Mensajes</th>
                    <th className="num-col">CPR</th>
                    <th className="num-col">Compras</th>
                    <th className="num-col">Valor</th>
                    <th className="num-col">Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {byClient.map(row => (
                    <tr key={row.client.id} className={row === byClient[0] ? 'is-top-row' : ''}>
                      <td>{row.client.name}</td>
                      <td className="num-col">{formatCop(row.spend)}</td>
                      <td className={`num-col ${row.roas >= 3 ? 'text-green' : row.roas >= 2 ? 'text-amber' : 'text-red'}`}>{formatRoas(row.roas)}</td>
                      <td className="num-col">{formatNumber(row.messages)}</td>
                      <td className="num-col">{formatCop(row.cpr)}</td>
                      <td className="num-col">{formatNumber(row.purchases)}</td>
                      <td className="num-col">{formatCop(row.purchase_value)}</td>
                      <td className="num-col">{formatNumber(row.leads)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="card section-block">
        <div className="section-heading"><h2>Detalle diario</h2></div>
        {filtered.length === 0 ? (
          <p className="empty-note">No hay detalle diario para el filtro actual.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {selectedClient === 'all' && <th>Cliente</th>}
                  <th>Fecha</th>
                  <th className="num-col">Inversión</th>
                  <th className="num-col">Alcance</th>
                  <th className="num-col">Impresiones</th>
                  <th className="num-col">Clics</th>
                  <th className="num-col">CTR</th>
                  <th className="num-col">CPM</th>
                  <th className="num-col">Mensajes</th>
                  <th className="num-col">CPR</th>
                  <th className="num-col">Leads</th>
                  <th className="num-col">Compras</th>
                  <th className="num-col">Valor</th>
                  <th className="num-col">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {[...filtered].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60).map(r => (
                  <tr key={r.id}>
                    {selectedClient === 'all' && <td>{clients.find(c => c.id === r.client_id)?.name ?? '—'}</td>}
                    <td>{r.date}</td>
                    <td className="num-col">{formatCop(r.spend)}</td>
                    <td className="num-col">{formatNumber(r.reach)}</td>
                    <td className="num-col">{formatNumber(r.impressions)}</td>
                    <td className="num-col">{formatNumber(r.clicks)}</td>
                    <td className="num-col">{r.ctr.toFixed(2)}%</td>
                    <td className="num-col">{formatCop(r.cpm)}</td>
                    <td className="num-col">{formatNumber(r.messages)}</td>
                    <td className="num-col">{formatCop(r.cpr)}</td>
                    <td className="num-col">{formatNumber(r.leads)}</td>
                    <td className="num-col">{formatNumber(r.purchases)}</td>
                    <td className="num-col">{formatCop(r.purchase_value)}</td>
                    <td className={`num-col ${r.roas >= 3 ? 'text-green' : r.roas >= 2 ? 'text-amber' : 'text-red'}`}>{formatRoas(r.roas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KM({ label, value, highlight }: { label: string; value: string; highlight?: 'green' | 'amber' | 'red' }) {
  return (
    <div className="kpi-box">
      <div className="kpi-box-label">{label}</div>
      <div className={`kpi-box-value ${highlight ? `text-${highlight}` : ''}`}>{value}</div>
    </div>
  );
}
