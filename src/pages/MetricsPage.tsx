import { useEffect, useMemo, useState } from 'react';
import { BarChart2 } from 'lucide-react';
import { MonthSelector } from '../components/MonthSelector';
import { useAdMetrics } from '../hooks/useData';
import { useClients } from '../hooks/useClients';
import {
  adDataOriginClass,
  adDataOriginLabel,
  formatCop,
  formatNumber,
  formatPct,
  formatRoas,
  sumMetrics,
  summarizeAdDataOrigin,
} from '../lib/utils';
import { getMonthLabel, getMonthKey, listAvailableMonthKeys } from '../utils/monthLabel';

export function MetricsPage() {
  const { clients } = useClients();
  const { metrics } = useAdMetrics(undefined, 400);
  const [selectedClient, setSelectedClient] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('');

  const availableMonths = useMemo(
    () => listAvailableMonthKeys(metrics.map((metric) => metric.date)),
    [metrics],
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
  const monthMetrics = useMemo(
    () => metrics.filter((metric) => getMonthKey(metric.date) === activeMonth),
    [activeMonth, metrics],
  );
  const filtered =
    selectedClient === 'all'
      ? monthMetrics
      : monthMetrics.filter((metric) => metric.client_id === selectedClient);
  const totals = sumMetrics(filtered);
  const sourceOrigin = summarizeAdDataOrigin(filtered.map((metric) => metric.source));

  const byClient = useMemo(
    () =>
      clients
        .map((client) => {
          const clientMetrics = monthMetrics.filter((metric) => metric.client_id === client.id);

          return {
            client,
            origin: summarizeAdDataOrigin(clientMetrics.map((metric) => metric.source)),
            ...sumMetrics(clientMetrics),
          };
        })
        .filter(
          (row) =>
            row.spend > 0 ||
            row.messages > 0 ||
            row.purchase_value > 0 ||
            row.purchases > 0 ||
            row.origin !== 'unknown',
        )
        .sort((left, right) => {
          if (right.roas !== left.roas) return right.roas - left.roas;
          return right.spend - left.spend;
        }),
    [clients, monthMetrics],
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <BarChart2
              size={20}
              style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }}
            />
            Métricas Ads
          </h1>
          <p className="page-subtitle">Detalle Ads del mes seleccionado · {selectedMonthLabel}</p>
        </div>
      </div>

      <div className="card section-block period-toolbar-card">
        <div className="period-toolbar">
          <div className="period-toolbar-copy">
            <div className="section-heading">
              <h2>Periodo visible</h2>
            </div>
            <p className="source-note">
              Esta vista muestra Ads del mes seleccionado. No es una lectura rolling de últimos 30
              días.
            </p>
            <div className="period-chip-row">
              <span className="meta-chip">{selectedMonthLabel}</span>
              <span className={`meta-chip ${adDataOriginClass(sourceOrigin)}`}>
                {adDataOriginLabel(sourceOrigin)}
              </span>
              {selectedClient !== 'all' && (
                <span className="meta-chip">
                  {clients.find((client) => client.id === selectedClient)?.name ?? 'Cliente'}
                </span>
              )}
            </div>
          </div>
          <MonthSelector
            label="Mes visible"
            value={activeMonth}
            options={availableMonths.length > 0 ? availableMonths : [fallbackMonth]}
            helper="Se listan solo meses con registros reales en ad_metrics."
            onChange={setSelectedMonth}
          />
        </div>
      </div>

      <div className="filter-row">
        <button
          onClick={() => setSelectedClient('all')}
          className={`filter-chip ${selectedClient === 'all' ? 'active' : ''}`}
        >
          Todos los clientes
        </button>
        {clients.map((client) => (
          <button
            key={client.id}
            onClick={() => setSelectedClient(client.id)}
            className={`filter-chip ${selectedClient === client.id ? 'active' : ''}`}
          >
            {client.name}
          </button>
        ))}
      </div>

      <div className="kpi-row">
        <KM label="Inversión del mes" value={formatCop(totals.spend)} />
        <KM label="Valor compras" value={formatCop(totals.purchase_value)} />
        <KM
          label="ROAS Ads"
          value={formatRoas(totals.roas)}
          highlight={totals.roas >= 3 ? 'green' : totals.roas >= 2 ? 'amber' : 'red'}
        />
        <KM label="Mensajes" value={formatNumber(totals.messages)} />
        <KM label="Leads" value={formatNumber(totals.leads)} />
        <KM label="Compras" value={formatNumber(totals.purchases)} />
        <KM label="Alcance" value={formatNumber(totals.reach)} />
        <KM label="Fuente Ads" value={adDataOriginLabel(sourceOrigin)} />
      </div>

      {selectedClient === 'all' && (
        <div className="card section-block">
          <div className="section-heading">
            <h2>Comparativa por cliente</h2>
          </div>
          <p className="source-note">Comparativo consolidado del mes seleccionado.</p>
          {byClient.length === 0 ? (
            <p className="empty-note">No hay métricas registradas para este mes.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Fuente</th>
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
                  {byClient.map((row) => (
                    <tr key={row.client.id} className={row === byClient[0] ? 'is-top-row' : ''}>
                      <td>{row.client.name}</td>
                      <td>
                        <span className={`meta-chip ${adDataOriginClass(row.origin)}`}>
                          {adDataOriginLabel(row.origin)}
                        </span>
                      </td>
                      <td className="num-col">{formatCop(row.spend)}</td>
                      <td
                        className={`num-col ${
                          row.roas >= 3 ? 'text-green' : row.roas >= 2 ? 'text-amber' : 'text-red'
                        }`}
                      >
                        {formatRoas(row.roas)}
                      </td>
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
        <div className="section-heading">
          <h2>Detalle del mes seleccionado</h2>
        </div>
        <p className="source-note">
          Filas diarias o snapshots mensuales según la fuente disponible para {selectedMonthLabel}.
        </p>
        {filtered.length === 0 ? (
          <p className="empty-note">No hay detalle Ads para el filtro actual.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {selectedClient === 'all' && <th>Cliente</th>}
                  <th>Fecha</th>
                  <th>Fuente</th>
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
                {[...filtered]
                  .sort((left, right) => right.date.localeCompare(left.date))
                  .map((row) => {
                    const rowOrigin = summarizeAdDataOrigin([row.source]);

                    return (
                      <tr key={row.id}>
                        {selectedClient === 'all' && (
                          <td>{clients.find((client) => client.id === row.client_id)?.name ?? '—'}</td>
                        )}
                        <td>{row.date}</td>
                        <td>
                          <span className={`meta-chip ${adDataOriginClass(rowOrigin)}`}>
                            {adDataOriginLabel(rowOrigin)}
                          </span>
                        </td>
                        <td className="num-col">{formatCop(row.spend)}</td>
                        <td className="num-col">{formatNumber(row.reach)}</td>
                        <td className="num-col">{formatNumber(row.impressions)}</td>
                        <td className="num-col">{formatNumber(row.clicks)}</td>
                        <td className="num-col">{formatPct(row.ctr)}</td>
                        <td className="num-col">{formatCop(row.cpm)}</td>
                        <td className="num-col">{formatNumber(row.messages)}</td>
                        <td className="num-col">{formatCop(row.cpr)}</td>
                        <td className="num-col">{formatNumber(row.leads)}</td>
                        <td className="num-col">{formatNumber(row.purchases)}</td>
                        <td className="num-col">{formatCop(row.purchase_value)}</td>
                        <td
                          className={`num-col ${
                            row.roas >= 3 ? 'text-green' : row.roas >= 2 ? 'text-amber' : 'text-red'
                          }`}
                        >
                          {formatRoas(row.roas)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KM({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: 'green' | 'amber' | 'red';
}) {
  return (
    <div className="kpi-box">
      <div className="kpi-box-label">{label}</div>
      <div className={`kpi-box-value ${highlight ? `text-${highlight}` : ''}`}>{value}</div>
    </div>
  );
}
