import { Component, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  BarChart2,
  TrendingUp,
  ClipboardList,
  CheckSquare,
  FolderOpen,
  MapPin,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react';
import { ClientFileModal } from '../components/ClientFileModal';
import { HistoricalMonthlyModal } from '../components/HistoricalMonthlyModal';
import { MonthSelector } from '../components/MonthSelector';
import { SalesModal } from '../components/SalesModal';
import { useAuth } from '../hooks/useAuth';
import { useClientWorkspace } from '../hooks/useClientWorkspace';
import {
  adDataOriginClass,
  adDataOriginLabel,
  activityActionLabel,
  formatCop,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPct,
  formatRoas,
  getDateKey,
  getMonthStartKey,
  getYearStartKey,
  healthStatusLabel,
  hasSpecialMonthlyMetricData,
  isDateWithinRange,
  isAlertSnoozed,
  metaSyncStatusClass,
  metaSyncStatusLabel,
  resolveMonthlyProfileVisits,
  statusLabel,
  sumMetrics,
  sumOperatingKpis,
  sumSales,
  summarizeAdDataOrigin,
} from '../lib/utils';
import { getMonthKey, getMonthLabel, listAvailableMonthKeys } from '../utils/monthLabel';
import type {
  AdMetric,
  ActivityLog,
  Alert,
  Client,
  ClientHealthScore,
  ClientMetaOverview,
  ClientFile,
  ClientDailyOperatingKpi,
  ClientMonthlyOperatingKpi,
  DailySale,
  OperationalIssue,
  SocialMonthlyMetric,
  Strategy,
  Task,
  TaskUpdateInput,
} from '../lib/supabase';

type Tab = 'overview' | 'metrics' | 'sales' | 'strategies' | 'tasks' | 'files';

function sortKey(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function compareDesc(left: unknown, right: unknown): number {
  return sortKey(right).localeCompare(sortKey(left));
}

function sectionLabel(section: string): string {
  const labels: Record<string, string> = {
    client: 'cliente',
    metrics: 'Ads',
    dailyKpis: 'KPI diarios',
    monthlyKpis: 'histórico mensual',
    sales: 'ventas',
    strategies: 'estrategias',
    tasks: 'tareas',
    alerts: 'alertas',
    files: 'archivos',
    activityLog: 'actividad',
    meta: 'estado Meta',
    social: 'seguidores',
    operational: 'salud operativa',
  };

  return labels[section] ?? section;
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    client,
    metrics,
    dailyKpis,
    monthlyKpis,
    sales,
    socialMonthlyMetrics,
    strategies,
    tasks,
    alerts,
    files,
    activityLog,
    health,
    issues,
    meta,
    loading,
    error,
    sectionErrors,
    addSale,
    addHistoricalAds,
    addHistoricalSales,
    addSocialMonthlyMetric,
    addFile,
    updateTask,
  } = useClientWorkspace(id, 400);
  const { isInternal, canWriteSales, role } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [showHistoricalModal, setShowHistoricalModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');

  const recentOperatingKpis = useMemo(
    () => [...dailyKpis].sort((a, b) => compareDesc(a.date, b.date)).slice(0, 7),
    [dailyKpis],
  );
  const monthlyHistory = useMemo(
    () => [...monthlyKpis].sort((a, b) => compareDesc(a.month, b.month)).slice(0, 8),
    [monthlyKpis],
  );
  const availableMonths = useMemo(
    () =>
      listAvailableMonthKeys([
        ...monthlyKpis.map((row) => row.month),
        ...metrics.map((row) => row.date),
        ...sales.map((row) => row.date),
        ...socialMonthlyMetrics.map((row) => row.month),
      ]),
    [metrics, monthlyKpis, sales, socialMonthlyMetrics],
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

  const selectedMonthLabel = getMonthLabel(selectedMonth || fallbackMonth);
  const selectedMonthMetrics = useMemo(
    () => metrics.filter((row) => getMonthKey(row.date) === (selectedMonth || fallbackMonth)),
    [fallbackMonth, metrics, selectedMonth],
  );
  const selectedMonthSales = useMemo(
    () => sales.filter((row) => getMonthKey(row.date) === (selectedMonth || fallbackMonth)),
    [fallbackMonth, sales, selectedMonth],
  );
  const selectedMonthRow = useMemo(
    () =>
      monthlyKpis.find((row) => getMonthKey(row.month) === (selectedMonth || fallbackMonth)) ?? null,
    [fallbackMonth, monthlyKpis, selectedMonth],
  );
  const selectedSocialMetric = useMemo(
    () =>
      socialMonthlyMetrics.find(
        (row) => getMonthKey(row.month) === (selectedMonth || fallbackMonth),
      ) ?? null,
    [fallbackMonth, selectedMonth, socialMonthlyMetrics],
  );
  const selectedMonthMetricTotals = useMemo(
    () => sumMetrics(selectedMonthMetrics),
    [selectedMonthMetrics],
  );
  const selectedMonthSalesTotals = useMemo(
    () => sumSales(selectedMonthSales),
    [selectedMonthSales],
  );
  const today = getDateKey();
  const currentMonthStart = getMonthStartKey();
  const currentYearStart = getYearStartKey();
  const currentMonthSales = useMemo(
    () => sales.filter((row) => isDateWithinRange(row.date, currentMonthStart, today)),
    [currentMonthStart, sales, today],
  );
  const currentYearSales = useMemo(
    () => sales.filter((row) => isDateWithinRange(row.date, currentYearStart, today)),
    [currentYearStart, sales, today],
  );
  const currentMonthSalesTotals = useMemo(() => sumSales(currentMonthSales), [currentMonthSales]);
  const currentYearSalesTotals = useMemo(() => sumSales(currentYearSales), [currentYearSales]);
  const recentSales = useMemo(
    () => [...sales].sort((a, b) => compareDesc(a.date, b.date)).slice(0, 8),
    [sales],
  );
  const selectedPeriodTotals = useMemo(() => {
    if (selectedMonthRow) return sumOperatingKpis([selectedMonthRow]);

    const spend = selectedMonthMetricTotals.spend;
    const totalSales = selectedMonthSalesTotals.total;

    return {
      ...selectedMonthMetricTotals,
      total_sales: totalSales,
      new_client_sales: selectedMonthSalesTotals.newClient,
      repeat_sales: selectedMonthSalesTotals.repeat,
      physical_store_sales: selectedMonthSalesTotals.physical,
      online_sales: selectedMonthSalesTotals.online,
      ad_roas: selectedMonthMetricTotals.roas,
      real_roas: spend > 0 ? totalSales / spend : 0,
    };
  }, [selectedMonthMetricTotals, selectedMonthRow, selectedMonthSalesTotals]);
  const selectedAdsOrigin = useMemo(
    () => summarizeAdDataOrigin(selectedMonthMetrics.map((row) => row.source)),
    [selectedMonthMetrics],
  );
  const selectedProfileVisits = useMemo(
    () =>
      resolveMonthlyProfileVisits({
        socialMetric: selectedSocialMetric,
        adMetrics: selectedMonthMetrics,
      }),
    [selectedMonthMetrics, selectedSocialMetric],
  );
  const selectedFollowerConversion =
    selectedSocialMetric && selectedProfileVisits.value && selectedProfileVisits.value > 0
      ? (selectedSocialMetric.new_followers / selectedProfileVisits.value) * 100
      : null;
  const selectedMonthHasData =
    Boolean(selectedMonthRow) ||
    selectedMonthMetrics.length > 0 ||
    selectedMonthSales.length > 0 ||
    Boolean(selectedSocialMetric);
  const monthlyHistoryRows = useMemo(
    () =>
      monthlyHistory.map((row) => ({
        ...row,
        adsOrigin: summarizeAdDataOrigin(
          metrics
            .filter((metric) => getMonthKey(metric.date) === getMonthKey(row.month))
            .map((metric) => metric.source),
        ),
      })),
    [metrics, monthlyHistory],
  );

  const canRegisterSales = client ? canWriteSales(client.id) : false;
  const canLoadHistory = role === 'admin';
  const isResolvedClient =
    Boolean(client) && Boolean(id) && (client?.id === id || client?.slug === id);
  const allTabs: { key: Tab; label: string; icon: ReactNode }[] = [
    { key: 'overview', label: 'Resumen', icon: <BarChart2 size={14} /> },
    { key: 'metrics', label: 'Ads', icon: <TrendingUp size={14} /> },
    { key: 'sales', label: 'Ventas', icon: <TrendingUp size={14} /> },
    { key: 'strategies', label: 'Estrategias', icon: <ClipboardList size={14} /> },
    { key: 'tasks', label: 'Tareas', icon: <CheckSquare size={14} /> },
    { key: 'files', label: 'Archivos', icon: <FolderOpen size={14} /> },
  ];
  const tabs = allTabs.filter((entry) =>
    isInternal || ['overview', 'metrics', 'sales', 'files'].includes(entry.key),
  );

  useEffect(() => {
    if (!tabs.some((entry) => entry.key === tab)) {
      setTab(tabs[0]?.key ?? 'overview');
    }
  }, [tab, tabs]);

  if (loading && !isResolvedClient) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <h3>Cargando cliente...</h3>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <h3>{error ? 'No se pudo cargar el cliente' : 'Cliente no encontrado'}</h3>
          <p>
            {error
              ? error
              : 'Verifica que el cliente exista en Supabase y que tengas acceso a su workspace.'}
          </p>
        </div>
      </div>
    );
  }

  const criticalAlerts = alerts.filter(
    (alert) =>
      alert.severity === 'critical' &&
      ['unread', 'read'].includes(alert.status) &&
      !isAlertSnoozed(alert),
  );
  const metaStatus = meta?.sync_status ?? 'no_data';
  const activeMonth = selectedMonth || fallbackMonth;

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-left">
          {isInternal ? (
            <Link to="/clients" className="back-link"><ArrowLeft size={14} /> Clientes</Link>
          ) : (
            <span className="meta-chip">Mi espacio</span>
          )}
          <div className="client-page-title">
            <h1 className="page-title">{client.name}</h1>
            <span className="client-niche-tag">{client.niche || 'Sin nicho'}</span>
          </div>
          {client.main_city && <span className="meta-chip"><MapPin size={11} /> {client.main_city}</span>}
          {client.drive_folder_url && (
            <a href={client.drive_folder_url} target="_blank" rel="noreferrer" className="meta-chip clickable">
              <ExternalLink size={11} /> Drive
            </a>
          )}
          <span className={`status-pill ${metaSyncStatusClass(metaStatus)}`}>
            Meta {metaSyncStatusLabel(metaStatus)}
          </span>
          <span className="meta-chip">
            {meta?.last_sync_at ? `Última sync ${formatDateTime(meta.last_sync_at)}` : 'Sin sincronización'}
          </span>
        </div>
        <div className="header-actions">
          {canLoadHistory && (
            <button className="btn-secondary" onClick={() => setShowHistoricalModal(true)}>
              + Cargar histórico
            </button>
          )}
          {canRegisterSales && (
            <button className="btn-primary" onClick={() => setShowSalesModal(true)}>
              + Registrar Ventas
            </button>
          )}
        </div>
      </div>

      <div className="card section-block period-toolbar-card">
        <div className="period-toolbar">
          <div className="period-toolbar-copy">
            <div className="section-heading">
              <h2>Periodo de lectura</h2>
            </div>
            <p className="source-note">
              Resumen, Ads y Ventas usan el mes seleccionado. Estado Meta y salud operativa siguen
              mostrando lectura actual.
            </p>
            <div className="period-chip-row">
              <span className="meta-chip">{selectedMonthLabel}</span>
              <span className={`meta-chip ${adDataOriginClass(selectedAdsOrigin)}`}>
                Ads {adDataOriginLabel(selectedAdsOrigin)}
              </span>
              <span className="meta-chip">Ventas reportadas manualmente</span>
              <span className="meta-chip">
                Seguidores {selectedSocialMetric ? 'manual mensual' : 'sin cierre cargado'}
              </span>
              <span className="meta-chip">
                {selectedMonthRow
                  ? 'Mes consolidado en vistas SQL'
                  : selectedMonthHasData
                    ? 'Sin cierre consolidado; leyendo registros del mes'
                    : 'Sin datos para el mes seleccionado'}
              </span>
            </div>
          </div>
          <MonthSelector
            label="Mes visible"
            value={activeMonth}
            options={availableMonths.length > 0 ? availableMonths : [fallbackMonth]}
            helper="Los meses disponibles salen de Ads automáticos, histórico manual y ventas reportadas."
            onChange={setSelectedMonth}
          />
        </div>
      </div>

      <div className="kpi-strip">
        <div className="kpi-strip-item">
          <span className="kpi-strip-label">Periodo</span>
          <span className="kpi-strip-value">{selectedMonthLabel}</span>
        </div>
        <div className="kpi-strip-item">
          <span className="kpi-strip-label">Ads</span>
          <span className="kpi-strip-value">
            {selectedMonthHasData ? formatCop(selectedPeriodTotals.spend) : '—'}
          </span>
        </div>
        <div className="kpi-strip-item">
          <span className="kpi-strip-label">ROAS Ads</span>
          <span
            className={`kpi-strip-value roas-color-${
              selectedPeriodTotals.ad_roas >= 3
                ? 'good'
                : selectedPeriodTotals.ad_roas >= 2
                  ? 'ok'
                  : 'low'
            }`}
          >
            {selectedMonthHasData ? formatRoas(selectedPeriodTotals.ad_roas) : '—'}
          </span>
        </div>
        <div className="kpi-strip-item">
          <span className="kpi-strip-label">Mensajes</span>
          <span className="kpi-strip-value">
            {selectedMonthHasData ? formatNumber(selectedPeriodTotals.messages) : '—'}
          </span>
        </div>
        <div className="kpi-strip-item">
          <span className="kpi-strip-label">Ventas</span>
          <span className="kpi-strip-value">
            {selectedMonthHasData ? formatCop(selectedPeriodTotals.total_sales) : '—'}
          </span>
        </div>
        <div className="kpi-strip-item">
          <span className="kpi-strip-label">ROAS operativo</span>
          <span
            className={`kpi-strip-value roas-color-${
              selectedPeriodTotals.real_roas >= 3
                ? 'good'
                : selectedPeriodTotals.real_roas >= 2
                  ? 'ok'
                  : 'low'
            }`}
          >
            {selectedMonthHasData ? formatRoas(selectedPeriodTotals.real_roas) : '—'}
          </span>
        </div>
      </div>

      {isInternal && (health || criticalAlerts.length > 0) && (
        <ClientOperationalBanner health={health} issues={issues} criticalAlerts={criticalAlerts} />
      )}

      {sectionErrors.length > 0 && (
        <div className="card section-block workspace-warning-banner">
          <div className="section-heading">
            <h2>Vista parcial del cliente</h2>
          </div>
          <p className="workspace-warning-copy">
            Algunas secciones no cargaron correctamente. El resto del workspace sigue disponible.
          </p>
          <div className="workspace-warning-list">
            {sectionErrors.map((entry, index) => (
              <span key={`${entry.section}-${index}`} className="meta-chip">
                {sectionLabel(entry.section)}
              </span>
            ))}
          </div>
        </div>
      )}

      <MonthlyHistoryCard
        rows={monthlyHistoryRows}
        selectedMonth={activeMonth}
        selectedMonthLabel={selectedMonthLabel}
      />

      <div className="tab-bar">
        {tabs.map((currentTab) => (
          <button
            key={currentTab.key}
            onClick={() => setTab(currentTab.key)}
            className={`tab-btn ${tab === currentTab.key ? 'active' : ''}`}
          >
            {currentTab.icon} {currentTab.label}
          </button>
        ))}
      </div>

      <ClientDetailRenderBoundary resetKey={`${client.id}-${tab}`}>
        {tab === 'overview' && (
          <ClientOverview
            client={client}
            health={health}
            issues={issues}
            meta={meta}
            selectedMonthLabel={selectedMonthLabel}
            selectedMonthHasData={selectedMonthHasData}
            selectedMonthOrigin={selectedAdsOrigin}
            socialMetric={selectedSocialMetric}
            profileVisits={selectedProfileVisits}
            followerConversion={selectedFollowerConversion}
            hasSpecialMetricData={hasSpecialMonthlyMetricData(selectedSocialMetric)}
            operatingTotals={selectedPeriodTotals}
            operatingRows={recentOperatingKpis}
            currentMonthSalesTotals={currentMonthSalesTotals}
            currentYearSalesTotals={currentYearSalesTotals}
            currentMonthSalesCount={currentMonthSales.length}
            currentYearSalesCount={currentYearSales.length}
            recentSales={recentSales}
            activityLog={activityLog}
            showOperational={isInternal}
          />
        )}
        {tab === 'metrics' && (
          <ClientMetricsTab
            metrics={selectedMonthMetrics}
            selectedMonthLabel={selectedMonthLabel}
            origin={selectedAdsOrigin}
          />
        )}
        {tab === 'sales' && (
          <ClientSalesTab
            sales={selectedMonthSales}
            selectedMonthLabel={selectedMonthLabel}
          />
        )}
        {tab === 'strategies' && <ClientStrategiesTab strategies={strategies} clientId={client.id} />}
        {tab === 'tasks' && <ClientTasksTab tasks={tasks} updateTask={updateTask} />}
        {tab === 'files' && (
          <ClientFilesTab
            files={files}
            strategies={strategies}
            onAddFile={isInternal ? () => setShowFileModal(true) : undefined}
          />
        )}
      </ClientDetailRenderBoundary>

      {showSalesModal && (
        <SalesModal
          clientId={client.id}
          clientName={client.name}
          onClose={() => setShowSalesModal(false)}
          onSave={async (data) => {
            const result = await addSale(data);
            if (!result.error) setShowSalesModal(false);
            return result;
          }}
        />
      )}

      {isInternal && showFileModal && (
        <ClientFileModal
          clientId={client.id}
          strategies={strategies}
          onClose={() => setShowFileModal(false)}
          onSave={async (data) => {
            const result = await addFile(data);
            if (!result.error) setShowFileModal(false);
            return result;
          }}
        />
      )}

      {canLoadHistory && showHistoricalModal && (
        <HistoricalMonthlyModal
          clientName={client.name}
          onClose={() => setShowHistoricalModal(false)}
          onSaveAds={addHistoricalAds}
          onSaveSales={addHistoricalSales}
          onSaveSocial={addSocialMonthlyMetric}
        />
      )}
    </div>
  );
}

function ClientOverview({
  operatingTotals,
  operatingRows,
  client,
  health,
  issues,
  meta,
  activityLog,
  selectedMonthLabel,
  selectedMonthHasData,
  selectedMonthOrigin,
  socialMetric,
  profileVisits,
  followerConversion,
  hasSpecialMetricData,
  currentMonthSalesTotals,
  currentYearSalesTotals,
  currentMonthSalesCount,
  currentYearSalesCount,
  recentSales,
  showOperational,
}: {
  operatingTotals: ReturnType<typeof sumOperatingKpis>;
  operatingRows: ClientDailyOperatingKpi[];
  client: Client;
  health: ClientHealthScore | null;
  issues: OperationalIssue[];
  meta: ClientMetaOverview | null;
  activityLog: ActivityLog[];
  selectedMonthLabel: string;
  selectedMonthHasData: boolean;
  selectedMonthOrigin: ReturnType<typeof summarizeAdDataOrigin>;
  socialMetric: SocialMonthlyMetric | null;
  profileVisits: ReturnType<typeof resolveMonthlyProfileVisits>;
  followerConversion: number | null;
  hasSpecialMetricData: boolean;
  currentMonthSalesTotals: ReturnType<typeof sumSales>;
  currentYearSalesTotals: ReturnType<typeof sumSales>;
  currentMonthSalesCount: number;
  currentYearSalesCount: number;
  recentSales: DailySale[];
  showOperational: boolean;
}) {
  const metaStatus = meta?.sync_status ?? 'no_data';
  const currentSalesMonthLabel = getMonthLabel(getDateKey());
  const currentSalesYearLabel = getDateKey().slice(0, 4);

  return (
    <div className="tab-content overview-grid">
      {showOperational && health && (
        <div className="card section-block">
          <div className="section-heading"><h2>Salud operativa actual</h2></div>
          <p className="source-note">
            Este bloque no cambia con el selector de mes. Resume alertas, tareas y estado operativo
            reciente.
          </p>
          <div className="metric-grid-4">
            <MetricBox label="Score" value={String(health.score)} highlight={health.status === 'healthy' ? 'green' : health.status === 'warning' ? 'amber' : 'red'} />
            <MetricBox label="Estado" value={healthStatusLabel(health.status)} highlight={health.status === 'healthy' ? 'green' : health.status === 'warning' ? 'amber' : 'red'} />
            <MetricBox label="Alertas críticas" value={String(health.open_critical_alerts)} highlight={health.open_critical_alerts > 0 ? 'red' : undefined} />
            <MetricBox label="Tareas vencidas" value={String(health.overdue_tasks)} highlight={health.overdue_tasks > 0 ? 'amber' : undefined} />
            <MetricBox label="Ventas ayer" value={health.missing_sales_yesterday ? 'Faltan' : 'OK'} highlight={health.missing_sales_yesterday ? 'red' : 'green'} />
            <MetricBox label="Optimización" value={health.optimize_overdue ? 'Pendiente' : 'Al día'} highlight={health.optimize_overdue ? 'amber' : 'green'} />
            <MetricBox label="ROAS operativo" value={formatRoas(health.real_roas)} highlight={health.low_real_roas ? 'red' : 'green'} />
            <MetricBox label="Issues activos" value={String(issues.length)} highlight={issues.length > 0 ? 'amber' : 'green'} />
          </div>
        </div>
      )}

      <div className="card section-block">
        <div className="section-heading"><h2>Estado Meta actual</h2></div>
        <p className="source-note">
          Sync real de Meta por cuenta activa. Este bloque siempre muestra el estado actual, no el
          mes seleccionado.
        </p>
        <div className="operational-summary-row">
          <span className={`status-pill ${metaSyncStatusClass(metaStatus)}`}>
            Meta {metaSyncStatusLabel(metaStatus)}
          </span>
          <span className="meta-chip">
            {meta?.last_sync_at ? `Última sync ${formatDateTime(meta.last_sync_at)}` : 'Sin sincronización'}
          </span>
          <span className="meta-chip">
            {meta?.active_accounts ?? 0} cuenta{(meta?.active_accounts ?? 0) === 1 ? '' : 's'} activa{(meta?.active_accounts ?? 0) === 1 ? '' : 's'}
          </span>
          {(meta?.stale_accounts ?? 0) > 0 && (
            <span className="meta-chip">{meta?.stale_accounts} desactualizadas</span>
          )}
        </div>

        {(meta?.active_accounts ?? 0) === 0 ? (
          <p className="empty-note">No hay cuentas Meta activas asociadas a este cliente.</p>
        ) : (
          <>
            <div className="metric-grid-4">
              <MetricBox label="Inversión MTD" value={formatCop(meta?.mtd_spend ?? 0)} />
              <MetricBox
                label="ROAS Ads MTD"
                value={formatRoas(meta?.mtd_ad_roas ?? 0)}
                highlight={
                  !meta?.has_mtd_data
                    ? undefined
                    : (meta?.mtd_ad_roas ?? 0) >= 3
                      ? 'green'
                      : (meta?.mtd_ad_roas ?? 0) >= 2
                        ? 'amber'
                        : 'red'
                }
              />
              <MetricBox label="Mensajes MTD" value={formatNumber(meta?.mtd_messages ?? 0)} />
              <MetricBox label="Leads MTD" value={formatNumber(meta?.mtd_leads ?? 0)} />
              <MetricBox label="Compras MTD" value={formatNumber(meta?.mtd_purchases ?? 0)} />
              <MetricBox label="Valor compras MTD" value={formatCop(meta?.mtd_purchase_value ?? 0)} />
              <MetricBox label="Sync OK" value={String(meta?.synced_accounts ?? 0)} />
              <MetricBox label="Sync pendiente" value={String(meta?.stale_accounts ?? 0)} highlight={(meta?.stale_accounts ?? 0) > 0 ? 'amber' : 'green'} />
            </div>
            {!meta?.has_mtd_data && (
              <p className="empty-note">Todavía no hay métricas Ads MTD disponibles para este cliente.</p>
            )}
          </>
        )}
      </div>

      <div className="card section-block">
        <div className="section-heading"><h2>Ads — {selectedMonthLabel}</h2></div>
        <div className="operational-summary-row">
          <span className={`meta-chip ${adDataOriginClass(selectedMonthOrigin)}`}>
            {adDataOriginLabel(selectedMonthOrigin)}
          </span>
          <span className="meta-chip">
            {selectedMonthHasData
              ? `Lectura mensual ${selectedMonthLabel.toLowerCase()}`
              : `Sin Ads para ${selectedMonthLabel.toLowerCase()}`}
          </span>
        </div>
        {selectedMonthHasData ? (
          <div className="metric-grid-4">
            <MetricBox label="Inversión" value={formatCop(operatingTotals.spend)} />
            <MetricBox label="ROAS Ads" value={formatRoas(operatingTotals.ad_roas)} highlight={operatingTotals.ad_roas >= 3 ? 'green' : operatingTotals.ad_roas >= 2 ? 'amber' : 'red'} />
            <MetricBox label="Compras" value={formatNumber(operatingTotals.purchases)} />
            <MetricBox label="Valor compras" value={formatCop(operatingTotals.purchase_value)} />
            <MetricBox label="Mensajes" value={formatNumber(operatingTotals.messages)} />
            <MetricBox label="Leads" value={formatNumber(operatingTotals.leads)} />
            <MetricBox label="Alcance" value={formatNumber(operatingTotals.reach)} />
            <MetricBox label="Impresiones" value={formatNumber(operatingTotals.impressions)} />
          </div>
        ) : (
          <p className="empty-note">No hay métricas Ads para el mes seleccionado.</p>
        )}
      </div>

      <div className="card section-block">
        <div className="section-heading"><h2>Ventas del cliente</h2></div>
        <p className="source-note">
          Captura simple sobre ventas diarias. Este bloque resume mes en curso, año en curso y
          registros recientes del cliente.
        </p>
        {(currentMonthSalesTotals.total > 0 || currentYearSalesTotals.total > 0 || recentSales.length > 0) ? (
          <>
            <div className="operational-summary-row">
              <span className="meta-chip">Mes actual · {currentSalesMonthLabel}</span>
              <span className="meta-chip">Año actual · {currentSalesYearLabel}</span>
              <span className="meta-chip">Fuente oficial · ventas diarias</span>
            </div>
            <div className="metric-grid-4">
              <MetricBox label="Ventas del mes actual" value={formatCop(currentMonthSalesTotals.total)} />
              <MetricBox label="Ventas del año actual" value={formatCop(currentYearSalesTotals.total)} />
              <MetricBox label="Registros del mes" value={String(currentMonthSalesCount)} />
              <MetricBox label="Registros del año" value={String(currentYearSalesCount)} />
            </div>
          </>
        ) : (
          <p className="empty-note">
            No hay ventas registradas todavía para este cliente.
          </p>
        )}
      </div>

      <div className="card section-block">
        <div className="section-heading"><h2>Ventas recientes</h2></div>
        <p className="source-note">
          Listado simple de los últimos registros guardados. Solo muestra fecha y valor.
        </p>
        {recentSales.length > 0 ? (
          <div className="table-wrap responsive-card-table">
            <table className="client-sales-table simple-sales-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th className="num-col">Venta</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((sale) => (
                  <tr key={sale.id}>
                    <td data-label="Fecha">{formatDate(sale.date)}</td>
                    <td className="num-col" data-label="Venta">{formatCop(sale.total_sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-note">
            Todavía no hay ventas recientes registradas.
          </p>
        )}
      </div>

      <div className="card section-block">
        <div className="section-heading"><h2>Crecimiento social — {selectedMonthLabel}</h2></div>
        <p className="source-note">
          Seguidores cargados al cierre mensual. No se infieren desde Ads. Las visitas al perfil
          usan cierre manual y, si falta, fallback desde Ads solo cuando el mes sí trae
          `profile_visit_view`.
        </p>
        <div className="operational-summary-row">
          <span
            className={`meta-chip ${
              socialMetric ? 'source-manual' : adDataOriginClass(profileVisits.sourceOrigin)
            }`}
          >
            {socialMetric ? 'Fuente manual mensual' : profileVisits.sourceLabel}
          </span>
          <span className="meta-chip">Costo por seguidor: Pendiente de fuente</span>
        </div>
        <div className="metric-grid-4">
          <MetricBox
            label="Nuevos seguidores del mes"
            value={socialMetric ? formatNumber(socialMetric.new_followers) : 'Sin dato'}
          />
          <MetricBox
            label="Visitas al perfil del mes"
            value={profileVisits.value != null ? formatNumber(profileVisits.value) : 'Sin dato'}
          />
          <MetricBox
            label="Conversión visita → seguidor"
            value={followerConversion != null ? `${followerConversion.toFixed(1)}%` : '—'}
          />
          <MetricBox label="Costo por seguidor" value="Pendiente de fuente" />
        </div>
        {socialMetric?.notes && <p className="empty-note">{socialMetric.notes}</p>}
      </div>

      <div className="card section-block">
        <div className="section-heading"><h2>Métricas especiales — {selectedMonthLabel}</h2></div>
        <p className="source-note">
          Cierre mensual manual para señales especiales de negocio. No se mezclan con Ads rolling
          ni se infieren desde otras fuentes.
        </p>
        <div className="operational-summary-row">
          <span className={`meta-chip ${socialMetric ? 'source-manual' : 'source-unknown'}`}>
            {socialMetric ? 'Fuente manual mensual' : 'Sin cierre mensual cargado'}
          </span>
        </div>
        {hasSpecialMetricData ? (
          <div className="metric-grid-4">
            <MetricBox
              label="Clicks WhatsApp"
              value={formatNullableCount(socialMetric?.whatsapp_clicks)}
            />
            <MetricBox
              label="Clicks al link"
              value={formatNullableCount(socialMetric?.link_clicks)}
            />
            <MetricBox
              label="Nuevos clientes reportados"
              value={formatNullableCount(socialMetric?.new_customers_reported)}
            />
            <MetricBox
              label="Recompra reportada"
              value={formatNullableCount(socialMetric?.returning_customers_reported)}
            />
            <MetricBox
              label="Visitas a tienda"
              value={formatNullableCount(socialMetric?.store_visits_reported)}
            />
          </div>
        ) : (
          <p className="empty-note">
            Todavía no hay métricas especiales cargadas para este mes.
          </p>
        )}
      </div>

      <div className="card section-block">
        <div className="section-heading"><h2>Ads recientes — últimos 7 días</h2></div>
        <p className="source-note">
          Bloque rolling para leer tendencia reciente sin cambiar el consolidado mensual.
        </p>
        {operatingRows.length === 0 ? (
          <p className="empty-note">Sin métricas recientes para este cliente.</p>
        ) : (
          <div className="mini-table">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th className="num-col">Inversión</th>
                  <th className="num-col">ROAS</th>
                  <th className="num-col">Mensajes</th>
                  <th className="num-col">ROAS operativo</th>
                </tr>
              </thead>
              <tbody>
                {operatingRows.map((row) => (
                  <tr key={`${row.client_id}-${row.date}`}>
                    <td>{formatDate(row.date)}</td>
                    <td className="num-col">{formatCop(row.spend)}</td>
                    <td className={`num-col ${row.ad_roas >= 3 ? 'text-green' : row.ad_roas >= 2 ? 'text-amber' : 'text-red'}`}>{formatRoas(row.ad_roas)}</td>
                    <td className="num-col">{formatNumber(row.messages)}</td>
                    <td className={`num-col ${row.real_roas >= 3 ? 'text-green' : row.real_roas >= 2 ? 'text-amber' : 'text-red'}`}>{formatRoas(row.real_roas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {client.notes && (
        <div className="card section-block">
          <div className="section-heading"><h2>Notas del cliente</h2></div>
          <p className="notes-text">{client.notes}</p>
        </div>
      )}

      {showOperational && (
        <div className="card section-block">
          <div className="section-heading"><h2>Actividad reciente</h2></div>
          {activityLog.length === 0 ? (
            <p className="empty-note">Todavía no hay movimientos auditados para este cliente.</p>
          ) : (
            <div className="activity-feed">
              {activityLog.map((entry) => (
                <div key={entry.id} className="activity-row">
                  <div className="activity-row-main">
                    <strong>{activityActionLabel(entry.action)}</strong>
                    {entry.description && <span>{entry.description}</span>}
                  </div>
                  <span className="activity-row-time">{formatDateTime(entry.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MonthlyHistoryCard({
  rows,
  selectedMonth,
  selectedMonthLabel,
}: {
  rows: Array<ClientMonthlyOperatingKpi & { adsOrigin: ReturnType<typeof summarizeAdDataOrigin> }>;
  selectedMonth: string;
  selectedMonthLabel: string;
}) {
  return (
    <div className="card section-block">
      <div className="section-heading">
        <h2>Histórico mensual consolidado</h2>
      </div>
      <p className="source-note">
        Meses cerrados del más reciente al más antiguo. Incluye datos sincronizados y/o histórico
        manual según disponibilidad.
      </p>
      {rows.length === 0 ? (
        <p className="empty-note">Todavía no hay meses consolidados para este cliente.</p>
      ) : (
        <div className="table-wrap responsive-card-table">
          <table className="monthly-history-table">
            <thead>
              <tr>
                <th>Mes</th>
                <th>Fuente Ads</th>
                <th className="num-col">Ads</th>
                <th className="num-col">ROAS Ads</th>
                <th className="num-col">Ventas</th>
                <th className="num-col">ROAS operativo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isSelected = getMonthKey(row.month) === selectedMonth;

                return (
                  <tr
                    key={`${row.client_id}-${row.month}`}
                    className={isSelected ? 'is-selected-row' : undefined}
                  >
                    <td data-label="Mes">
                      <div className="table-primary-cell">
                        <strong>{getMonthLabel(row.month)}</strong>
                        {isSelected && <span className="table-secondary-note">Mes visible</span>}
                      </div>
                    </td>
                    <td data-label="Fuente Ads">
                      <span className={`meta-chip ${adDataOriginClass(row.adsOrigin)}`}>
                        {adDataOriginLabel(row.adsOrigin)}
                      </span>
                    </td>
                    <td className="num-col" data-label="Ads">{formatCop(row.spend)}</td>
                    <td
                      data-label="ROAS Ads"
                      className={`num-col ${
                        row.ad_roas >= 3 ? 'text-green' : row.ad_roas >= 2 ? 'text-amber' : 'text-red'
                      }`}
                    >
                      {formatRoas(row.ad_roas)}
                    </td>
                    <td className="num-col" data-label="Ventas">{formatCop(row.total_sales)}</td>
                    <td
                      data-label="ROAS operativo"
                      className={`num-col ${
                        row.real_roas >= 3
                          ? 'text-green'
                          : row.real_roas >= 2
                            ? 'text-amber'
                            : 'text-red'
                      }`}
                    >
                      {formatRoas(row.real_roas)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="operational-summary-row">
        <span className="meta-chip">Mes visible: {selectedMonthLabel}</span>
        <span className="meta-chip">ROAS operativo = ventas reportadas / inversión Ads</span>
      </div>
    </div>
  );
}

function ClientOperationalBanner({
  health,
  issues,
  criticalAlerts,
}: {
  health: ClientHealthScore | null;
  issues: OperationalIssue[];
  criticalAlerts: Alert[];
}) {
  if (!health && criticalAlerts.length === 0) return null;

  return (
    <div className="card section-block operational-banner">
      <div className="section-heading">
        <h2>Estado operativo</h2>
      </div>
      {health && (
        <div className="operational-summary-row">
          <span className={`health-badge status-${health.status}`}>
            Salud {health.score} · {healthStatusLabel(health.status)}
          </span>
          {health.missing_sales_yesterday && <span className="meta-chip">Falta venta de ayer</span>}
          {health.optimize_overdue && <span className="meta-chip">Toca optimización</span>}
          {health.overdue_tasks > 0 && <span className="meta-chip">{health.overdue_tasks} tareas vencidas</span>}
          {health.low_real_roas && <span className="meta-chip">ROAS operativo bajo</span>}
        </div>
      )}
      {issues.length > 0 && (
        <div className="operational-issues-list">
          {issues.map((issue) => (
            <div key={issue.type} className={`operational-issue ${issue.severity}`}>
              <strong>{issue.title}</strong>
              <span>{issue.body}</span>
            </div>
          ))}
        </div>
      )}
      {criticalAlerts.length > 0 && (
        <div className="operational-critical-list">
          {criticalAlerts.slice(0, 3).map((alert) => (
            <div key={alert.id} className="alert-item critical">
              <strong>{alert.title}</strong>
              {alert.body && <p>{alert.body}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: 'green' | 'amber' | 'red';
}) {
  return (
    <div className="metric-box">
      <span className="metric-box-label">{label}</span>
      <span className={`metric-box-value ${highlight ? `text-${highlight}` : ''}`}>{value}</span>
    </div>
  );
}

function ClientMetricsTab({
  metrics,
  selectedMonthLabel,
  origin,
}: {
  metrics: AdMetric[];
  selectedMonthLabel: string;
  origin: ReturnType<typeof summarizeAdDataOrigin>;
}) {
  const orderedMetrics = [...metrics].sort((a, b) => compareDesc(a.date, b.date));

  return (
    <div className="tab-content">
      <div className="card section-block">
        <div className="section-heading"><h2>Detalle Ads — {selectedMonthLabel}</h2></div>
        <div className="operational-summary-row">
          <span className={`meta-chip ${adDataOriginClass(origin)}`}>
            {adDataOriginLabel(origin)}
          </span>
          <span className="meta-chip">
            {orderedMetrics.length} registro{orderedMetrics.length === 1 ? '' : 's'} del mes
          </span>
        </div>
        {orderedMetrics.length === 0 ? (
          <p className="empty-note">No hay métricas Ads para el mes seleccionado.</p>
        ) : (
          <div className="table-wrap">
            <table className="client-metrics-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Fuente</th>
                  <th className="num-col">Inversión</th>
                  <th className="num-col">Alcance</th>
                  <th className="num-col">Impresiones</th>
                  <th className="num-col">Clics</th>
                  <th className="num-col">CPM</th>
                  <th className="num-col">CPC</th>
                  <th className="num-col">CTR</th>
                  <th className="num-col">Mensajes</th>
                  <th className="num-col">Leads</th>
                  <th className="num-col">Compras</th>
                  <th className="num-col">Valor</th>
                  <th className="num-col">ROAS</th>
                  <th className="num-col">CPR</th>
                </tr>
              </thead>
              <tbody>
                {orderedMetrics.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.date)}</td>
                    <td>
                      <span
                        className={`meta-chip ${adDataOriginClass(
                          summarizeAdDataOrigin([row.source]),
                        )}`}
                      >
                        {adDataOriginLabel(summarizeAdDataOrigin([row.source]))}
                      </span>
                    </td>
                    <td className="num-col">{formatCop(row.spend)}</td>
                    <td className="num-col">{formatNumber(row.reach)}</td>
                    <td className="num-col">{formatNumber(row.impressions)}</td>
                    <td className="num-col">{formatNumber(row.clicks)}</td>
                    <td className="num-col">{formatCop(row.cpm)}</td>
                    <td className="num-col">{formatCop(row.cpc)}</td>
                    <td className="num-col">{formatPct(row.ctr)}</td>
                    <td className="num-col">{formatNumber(row.messages)}</td>
                    <td className="num-col">{formatNumber(row.leads)}</td>
                    <td className="num-col">{formatNumber(row.purchases)}</td>
                    <td className="num-col">{formatCop(row.purchase_value)}</td>
                    <td className={`num-col ${row.roas >= 3 ? 'text-green' : row.roas >= 2 ? 'text-amber' : 'text-red'}`}>{formatRoas(row.roas)}</td>
                    <td className="num-col">{formatCop(row.cpr)}</td>
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

class ClientDetailRenderBoundary extends Component<
  {
    children: ReactNode;
    resetKey: string;
  },
  {
    hasError: boolean;
  }
> {
  state = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[client-detail] render', error, info);
  }

  componentDidUpdate(prevProps: Readonly<{ children: ReactNode; resetKey: string }>) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card section-block">
          <div className="section-heading"><h2>Sección no disponible</h2></div>
          <p className="empty-note">
            Una parte del detalle del cliente no pudo renderizarse. Cambia de pestaña o recarga la vista.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

function ClientSalesTab({
  sales,
  selectedMonthLabel,
}: {
  sales: DailySale[];
  selectedMonthLabel: string;
}) {
  const orderedSales = [...sales].sort((a, b) => compareDesc(a.date, b.date));

  return (
    <div className="tab-content">
      <div className="card section-block">
        <div className="section-heading"><h2>Ventas reportadas — {selectedMonthLabel}</h2></div>
        <p className="source-note">
          Esta tabla muestra solo fecha y venta del mes seleccionado registradas en ventas diarias.
        </p>
        {orderedSales.length === 0 ? (
          <p className="empty-note">No hay ventas reportadas para el mes seleccionado.</p>
        ) : (
          <div className="table-wrap responsive-card-table">
            <table className="client-sales-table simple-sales-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th className="num-col">Venta</th>
                </tr>
              </thead>
              <tbody>
                {orderedSales.map((sale) => (
                  <tr key={sale.id}>
                    <td data-label="Fecha">{formatDate(sale.date)}</td>
                    <td className="num-col" data-label="Venta">{formatCop(sale.total_sales)}</td>
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

function formatNullableCount(value: number | null | undefined): string {
  if (value == null) return 'Sin dato';
  return formatNumber(value);
}

function ClientStrategiesTab({
  strategies,
  clientId,
}: {
  strategies: Strategy[];
  clientId: string;
}) {
  return (
    <div className="tab-content">
      <div className="strategy-tab-header">
        <Link to={`/strategies?client=${clientId}`} className="btn-secondary">Ver en módulo de estrategias</Link>
      </div>
      {strategies.length === 0 ? (
        <div className="empty-state">
          <h3>Sin estrategias</h3>
          <p>Crea la primera estrategia para este cliente en el módulo de estrategias.</p>
        </div>
      ) : (
        <div className="strategy-list">
          {strategies.map((strategy) => (
            <div key={strategy.id} className="card strategy-card-compact">
              <div className="strategy-card-header">
                <div>
                  <h3>{strategy.title}</h3>
                  {strategy.month && (
                    <span className="strategy-month">
                      {new Date(`${strategy.month}T12:00:00`).toLocaleDateString('es-CO', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </div>
                <span className={`status-pill status-${strategy.status === 'approved' ? 'green' : strategy.status === 'mounted' ? 'blue' : strategy.status === 'reviewed' ? 'amber' : 'gray'}`}>
                  {statusLabel(strategy.status)}
                </span>
              </div>
              {typeof strategy.ai_summary === 'string' && strategy.ai_summary.trim() && (
                <p className="strategy-summary-preview">{strategy.ai_summary.slice(0, 160)}…</p>
              )}
              {strategy.monthly_budget && <span className="meta-chip">Presupuesto: {formatCop(strategy.monthly_budget)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientTasksTab({
  tasks,
  updateTask,
}: {
  tasks: Task[];
  updateTask: (id: string, updates: TaskUpdateInput) => Promise<unknown>;
}) {
  return (
    <div className="tab-content">
      <div className="card section-block">
        <div className="section-heading"><h2>Tareas</h2></div>
        {tasks.length === 0 ? (
          <p className="empty-note">No hay tareas para este cliente.</p>
        ) : (
          <div className="task-list">
            {tasks.map((task) => (
              <div key={task.id} className={`task-row ${task.status}`}>
                <button
                  className={`task-checkbox ${task.status === 'done' ? 'checked' : ''}`}
                  onClick={() => void updateTask(task.id, { status: task.status === 'done' ? 'pending' : 'done' })}
                >
                  {task.status === 'done' ? '✓' : ''}
                </button>
                <div className="task-body">
                  <span className={`task-title ${task.status === 'done' ? 'done-text' : ''}`}>{task.title}</span>
                  {task.description && <span className="task-desc">{task.description}</span>}
                </div>
                <div className="task-meta">
                  <span className={`priority-pill priority-${task.priority}`}>{task.priority}</span>
                  {task.due_date && (
                    <span className="task-due-date">
                      {new Date(`${task.due_date}T12:00:00`).toLocaleDateString('es-CO', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClientFilesTab({
  files,
  strategies,
  onAddFile,
}: {
  files: ClientFile[];
  strategies: Strategy[];
  onAddFile?: (() => void) | undefined;
}) {
  const strategyMap = new Map(strategies.map((strategy) => [strategy.id, strategy.title]));

  return (
    <div className="tab-content">
      {onAddFile && (
        <div className="strategy-tab-header">
          <button className="btn-primary" onClick={onAddFile}>
            + Registrar archivo
          </button>
        </div>
      )}
      <div className="card section-block">
        <div className="section-heading">
          <h2>Archivos del cliente</h2>
        </div>
        {files.length === 0 ? (
          <p className="empty-note">
            No hay archivos registrados todavía.
            {onAddFile ? ' Agrega links de Drive para ordenar creativos y documentos.' : ''}
          </p>
        ) : (
          <div className="table-wrap responsive-card-table">
            <table className="client-files-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Estrategia</th>
                  <th>Registrado</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <td data-label="Nombre">{file.name}</td>
                    <td data-label="Tipo">{file.file_type}</td>
                    <td data-label="Estrategia">{file.strategy_id ? strategyMap.get(file.strategy_id) ?? '—' : '—'}</td>
                    <td data-label="Registrado">{new Date(file.created_at).toLocaleDateString('es-CO')}</td>
                    <td data-label="Link">
                      <a href={file.drive_url} target="_blank" rel="noreferrer" className="link-small">
                        Abrir
                      </a>
                    </td>
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
