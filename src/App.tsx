import { useEffect, useMemo, useState } from "react";
import { ClientCards } from "./components/ClientCards";
import { KpiCard } from "./components/KpiCard";
import { RankingTable } from "./components/RankingTable";
import { BarChart } from "./components/charts/BarChart";
import { LineChart } from "./components/charts/LineChart";
import { clientsMonthlyData, type ClientMonthlyData } from "./data/months";
import { fetchMonthlyData } from "./data/remote";
import { ReportPage } from "./pages/ReportPage";
import {
  buildClientMetricsForMonth,
  buildMonthlyOverviewSeries,
  formatCop,
  formatInteger,
  formatRoas,
  getAvailableMonths,
  getMonthLabel,
  getOverviewMetrics,
  getPreviousMonth,
  sortByRoasDesc,
} from "./utils/calculations";

function App() {
  const isReportRoute = typeof window !== "undefined" && window.location.pathname === "/report";
  if (isReportRoute) {
    return <ReportPage />;
  }

  const [data, setData] = useState<ClientMonthlyData[]>(clientsMonthlyData);
  const [dataSource, setDataSource] = useState<"remote" | "local">("local");
  const monthOptions = useMemo(() => getAvailableMonths(data), [data]);
  const defaultMonth = monthOptions.includes("2026-02") ? "2026-02" : (monthOptions[0] ?? "2026-02");
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const activeMonth = selectedMonth ?? defaultMonth;

  useEffect(() => {
    if (!monthOptions.includes(selectedMonth)) {
      setSelectedMonth(defaultMonth);
    }
  }, [defaultMonth, monthOptions, selectedMonth]);

  useEffect(() => {
    const REMOTE_URL = import.meta.env.VITE_DATA_URL ?? "/data/monthly.json";

    let mounted = true;

    const loadRemoteData = async () => {
      try {
        const remoteData = await fetchMonthlyData(REMOTE_URL);
        if (!mounted) return;
        setData(remoteData);
        setDataSource("remote");
      } catch {
        if (!mounted) return;
        setData(clientsMonthlyData);
        setDataSource("local");
      }
    };

    void loadRemoteData();

    return () => {
      mounted = false;
    };
  }, []);

  const previousMonth = getPreviousMonth(monthOptions, activeMonth);
  const monthLabel = getMonthLabel(activeMonth);

  const metrics = buildClientMetricsForMonth(data, activeMonth, previousMonth);
  const rankedClients = sortByRoasDesc(metrics);
  const overview = getOverviewMetrics(metrics);

  const monthlySeries = buildMonthlyOverviewSeries(data);

  return (
    <div className="page-shell">
      <div className="page-bg" />
      <main className="layout">
        <header className="topbar card">
          <div>
            <p className="brand">J&S Analytics</p>
            <h1>Panel Ejecutivo de Performance y Rentabilidad</h1>
            <p className="subtitle">Corte mensual: {monthLabel}</p>
            <p className="subtitle source-note">
              Fuente: {dataSource === "remote" ? "Remota" : "Local (fallback)"}
            </p>
          </div>
          <div className="month-selector-wrap">
            <label htmlFor="monthSelector">Mes de análisis</label>
            <select
              id="monthSelector"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            >
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {getMonthLabel(month)}
                </option>
              ))}
            </select>
          </div>
        </header>

        <section className="card section-block overview-section">
          <div className="section-heading">
            <h2>Resumen General de Agencia</h2>
          </div>
          <div className="kpi-grid kpi-grid-expanded">
            <KpiCard label="Inversión total" value={formatCop(overview.totalInvestment)} />
            <KpiCard label="Ventas totales reportadas" value={formatCop(overview.totalReportedSales)} />
            <KpiCard label="ROAS general" value={formatRoas(overview.globalRoas)} />
            <KpiCard label="Mensajes totales" value={formatInteger(overview.totalMessages)} />
            <KpiCard label="CPR promedio ponderado" value={formatCop(overview.weightedCpr)} />
            <KpiCard label="Alcance total" value={formatInteger(overview.totalReach)} />
            <KpiCard label="Impresiones totales" value={formatInteger(overview.totalImpressions)} />
            <KpiCard
              label="Estado de cuentas"
              value={`${overview.profitableCount} rentables · ${overview.lossCount} en pérdida`}
              hint={`${overview.noDataCount} sin data`}
            />
          </div>
        </section>

        <section className="card section-block insight">
          <div className="section-heading">
            <h2>Lectura Estratégica del Mes</h2>
          </div>
          <p>
            El mes combina cuentas con tracción sólida y cuentas que requieren ajuste inmediato.
            La prioridad operativa es sostener la eficiencia en lo rentable y corregir rápido lo que
            no está entregando retorno.
          </p>
        </section>

        <section className="charts-grid">
          <LineChart
            title="Tendencia mensual de ROAS general"
            points={monthlySeries.map((point) => ({ month: point.month, value: point.globalRoas }))}
            emptyMessage="Agrega otro mes para ver tendencia"
          />
          <BarChart
            title="Mensajes totales por mes"
            points={monthlySeries.map((point) => ({ month: point.month, value: point.totalMessages }))}
            emptyMessage="Agrega otro mes para ver tendencia"
          />
        </section>

        <RankingTable clients={rankedClients} />
        <ClientCards
          clients={rankedClients}
          data={data}
          monthLabel={monthLabel}
          activeMonth={activeMonth}
          previousMonthExists={Boolean(previousMonth)}
        />
      </main>
    </div>
  );
}

export default App;
