import { useEffect, useMemo, useState } from "react";
import { ClientCharts } from "../components/ClientCharts";
import { KpiCard } from "../components/KpiCard";
import { clientsMonthlyData, type ClientMonthlyData } from "../data/months";
import { fetchMonthlyData } from "../data/remote";
import {
  buildClientMetricsForMonth,
  formatCop,
  formatInteger,
  formatRoas,
  getAvailableMonths,
  getMonthLabel,
  getPreviousMonth,
  type AccountStatus,
} from "../utils/calculations";

const copyByStatus: Record<AccountStatus, { diagnosis: string; direction: string }> = {
  "Sin Data": {
    diagnosis:
      "No hay reporte de ventas este mes, así que no podemos medir retorno real. Con datos incompletos, cualquier decisión es una apuesta, no estrategia.",
    direction:
      "Implementar reporte diario o semanal de ventas. Sin ventas reportadas no hay ROAS, y sin ROAS no se puede optimizar con precisión.",
  },
  "Sin Ventas Reportadas": {
    diagnosis:
      "Hay actividad publicitaria reportada, pero no hay ventas registradas para medir retorno económico real.",
    direction:
      "Prioridad inmediata: conectar reporte comercial con pauta para validar ventas y habilitar optimización basada en resultados.",
  },
  "Alto Rendimiento": {
    diagnosis:
      "Cuenta altamente rentable, con señal clara de tracción comercial y una base real para escalar con bajo riesgo.",
    direction:
      "Escalar de forma controlada, refrescar creativos y proteger la eficiencia en campañas con mejor retorno.",
  },
  "Rentable - Optimizable": {
    diagnosis:
      "Rentable y estable, con margen para mejorar eficiencia comercial y capturar más valor con la misma inversión.",
    direction:
      "Redistribuir presupuesto hacia activos ganadores y ajustar mensajes para elevar conversión en audiencias clave.",
  },
  "Margen Bajo": {
    diagnosis:
      "Retorno bajo para el capital invertido; se observan señales de desalineación entre oferta, mensaje y público.",
    direction:
      "Reorganizar estructura por nivel de intención, simplificar propuesta y ejecutar pruebas de validación rápida.",
  },
  "No Rentable": {
    diagnosis:
      "No está siendo rentable en el estado actual y requiere corrección inmediata para contener pérdida de eficiencia.",
    direction:
      "Pausar escalamiento, reenfocar objetivo comercial y reconstruir una estructura simple antes de reinvertir.",
  },
};

const namedCopy: Partial<Record<string, { diagnosis: string; direction: string }>> = {
  "Tienda de la Platería": {
    diagnosis:
      "Tienda de la Platería mantiene retorno sólido y consistente, con capacidad de crecimiento sin sacrificar desempeño.",
    direction:
      "Escalamiento controlado por tramos y disciplina de eficiencia para sostener calidad de resultados.",
  },
  "Libell Joyería": {
    diagnosis:
      "Libell Joyería conserva una base robusta de rentabilidad con volumen suficiente para crecer de forma ordenada.",
    direction:
      "Aplicar escalamiento controlado en campañas líderes y mantener eficiencia con optimización continua.",
  },
  "Empaques y Suministros": {
    diagnosis:
      "Empaques y Suministros mantiene rentabilidad, pero aún con espacio claro para capturar mejor desempeño comercial.",
    direction:
      "Priorizar optimización de estructura y mensaje para mejorar conversión y aprovechar mejor la inversión mensual.",
  },
  "Platería Rossy 2": {
    diagnosis:
      "Platería Rossy 2 requiere corrección inmediata: el retorno actual no justifica incremento de presupuesto.",
    direction:
      "No escalar hasta estabilizar. Corregir enfoque comercial y validar una estructura más eficiente antes de crecer.",
  },
  Ivalent: {
    diagnosis:
      "Ivalent muestra una respuesta comercial fuerte, apalancada por dinámica de evento y alta intención de compra.",
    direction:
      "Planificar continuidad con remarketing con incentivo para sostener tracción después del pico del evento.",
  },
  "Dulce María Collection": {
    diagnosis:
      "Dulce María Collection no tiene reporte de ventas; sin esa visibilidad no existe lectura real de rendimiento.",
    direction:
      "Prioridad total en reporte de ventas diario o semanal para habilitar análisis serio y decisiones con fundamento.",
  },
};

export function ReportPage() {
  const [data, setData] = useState<ClientMonthlyData[]>(clientsMonthlyData);
  const [dataSource, setDataSource] = useState<"remote" | "local">("local");

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

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const requestedClient = params.get("client") ?? "";
  const requestedMonth = params.get("month") ?? "2026-02";
  const shouldAutoPrint = params.get("print") === "1";

  const monthOptions = useMemo(() => getAvailableMonths(data), [data]);
  const activeMonth = monthOptions.includes(requestedMonth)
    ? requestedMonth
    : monthOptions.includes("2026-02")
      ? "2026-02"
      : (monthOptions[0] ?? "2026-02");

  const resolvedClientName = useMemo(() => {
    const exactMatch = data.find((client) => client.clientName === requestedClient);
    if (exactMatch) return exactMatch.clientName;
    return data[0]?.clientName ?? requestedClient;
  }, [data, requestedClient]);

  const previousMonth = getPreviousMonth(monthOptions, activeMonth);
  const clientMetric = useMemo(() => {
    const metrics = buildClientMetricsForMonth(data, activeMonth, previousMonth);
    return metrics.find((metric) => metric.name === resolvedClientName) ?? null;
  }, [activeMonth, data, previousMonth, resolvedClientName]);

  useEffect(() => {
    if (!shouldAutoPrint || !clientMetric) return;
    const timeoutId = window.setTimeout(() => {
      window.print();
    }, 750);
    return () => window.clearTimeout(timeoutId);
  }, [clientMetric, shouldAutoPrint]);

  if (!clientMetric) {
    return (
      <div className="page-shell">
        <div className="page-bg" />
        <main className="layout report-layout">
          <section className="card report-wrap">
            <h1>Reporte no disponible</h1>
            <p>No fue posible encontrar datos para el cliente solicitado.</p>
          </section>
        </main>
      </div>
    );
  }

  const copy = namedCopy[clientMetric.name] ?? copyByStatus[clientMetric.status];

  return (
    <div className="page-shell report-page">
      <div className="page-bg" />
      <main className="layout report-layout">
        <section className="card report-wrap">
          <header className="report-header">
            <div>
              <p className="brand">J&S Analytics</p>
              <h1>Reporte Ejecutivo por Cliente</h1>
              <p className="subtitle">{clientMetric.name} · {getMonthLabel(activeMonth)}</p>
              <p className="subtitle source-note">
                Fuente: {dataSource === "remote" ? "Remota" : "Local (fallback)"}
              </p>
            </div>
            <button type="button" className="report-print-btn no-print" onClick={() => window.print()}>
              Guardar como PDF
            </button>
          </header>

          <section className="section-block">
            <div className="section-heading">
              <h2>KPIs del Cliente</h2>
            </div>
            <div className="kpi-grid kpi-grid-expanded report-kpi-grid">
              <KpiCard label="Inversión" value={formatCop(clientMetric.investment)} />
              <KpiCard label="Ventas" value={formatCop(clientMetric.sales)} />
              <KpiCard label="ROAS" value={formatRoas(clientMetric.roas)} />
              <KpiCard label="Utilidad estimada" value={formatCop(clientMetric.estimatedProfit)} />
              <KpiCard label="Mensajes" value={formatInteger(clientMetric.messages)} />
              <KpiCard label="CPR" value={formatCop(clientMetric.cpr)} />
              <KpiCard label="Alcance" value={formatInteger(clientMetric.reach)} />
              <KpiCard label="Impresiones" value={formatInteger(clientMetric.impressions)} />
            </div>
          </section>

          <section className="card insight report-insight">
            <div className="section-heading">
              <h2>Diagnóstico Ejecutivo</h2>
            </div>
            <p>{copy.diagnosis}</p>
            <div className="section-heading report-next-step-title">
              <h2>Dirección Siguiente Mes</h2>
            </div>
            <p>{copy.direction}</p>
          </section>

          <section className="section-block">
            <ClientCharts clientName={clientMetric.name} data={data} />
          </section>
        </section>
      </main>
    </div>
  );
}
