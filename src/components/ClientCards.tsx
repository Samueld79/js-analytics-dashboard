import { useMemo, useState } from "react";
import type { ClientMonthlyData } from "../data/months";
import type { AccountStatus, ClientMetrics } from "../utils/calculations";
import { formatCop, formatPercent, formatRoas, getDelta } from "../utils/calculations";
import { downloadTextFile, generateClientCSV, sanitizeFilename } from "../utils/export";
import { ClientCharts } from "./ClientCharts";
import { StatusPill } from "./StatusPill";

type ClientCardsProps = {
  clients: ClientMetrics[];
  data: ClientMonthlyData[];
  monthLabel: string;
  activeMonth: string;
  previousMonthExists: boolean;
};

const copyByStatus: Record<AccountStatus, { diagnosis: string; direction: string }> = {
  "Sin Data": {
    diagnosis:
      "No hay reporte de ventas este mes, así que no podemos medir retorno real. Con datos incompletos, cualquier decisión es una apuesta, no estrategia.",
    direction:
      "Implementar reporte diario/semana de ventas (aunque sea simple). Sin ventas reportadas no hay ROAS, y sin ROAS no se puede optimizar con precisión.",
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
      "Prioridad total en reporte de ventas diario/semanal para habilitar análisis serio y decisiones con fundamento.",
  },
};

function getClientCopy(client: ClientMetrics): { diagnosis: string; direction: string } {
  return namedCopy[client.name] ?? copyByStatus[client.status];
}

function getDeltaClass(direction: "up" | "down" | "flat" | "none"): string {
  if (direction === "up") return "delta-up";
  if (direction === "down") return "delta-down";
  return "delta-neutral";
}

function formatDeltaText(direction: "up" | "down" | "flat" | "none", deltaPercent: number | null): string {
  if (direction === "none" || deltaPercent === null) return "—";
  if (direction === "flat") return "→ 0.0%";
  const arrow = direction === "up" ? "↑" : "↓";
  return `${arrow} ${Math.abs(deltaPercent).toFixed(1)}%`;
}

export function ClientCards({ clients, data, monthLabel, activeMonth, previousMonthExists }: ClientCardsProps) {
  const [search, setSearch] = useState("");
  const [openCharts, setOpenCharts] = useState<Record<string, boolean>>({});
  const normalizedSearch = search.trim().toLowerCase();
  const visibleClients = useMemo(
    () => clients.filter((client) => client.name.toLowerCase().includes(normalizedSearch)),
    [clients, normalizedSearch],
  );

  return (
    <section className="section-block">
      <div className="section-heading section-row">
        <h2>Vista Ejecutiva por Cliente</h2>
        <span className="visible-chip">{visibleClients.length} visibles</span>
      </div>
      <div className="client-toolbar card">
        <label htmlFor="clientSearch" className="sr-only">
          Buscar cliente
        </label>
        <input
          id="clientSearch"
          type="search"
          placeholder="Buscar cliente por nombre..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="clients-grid">
        {visibleClients.map((client) => {
          const copy = getClientCopy(client);
          const isChartsOpen = openCharts[client.name] ?? false;
          const fullClientData = data.find((item) => item.clientName === client.name) ?? null;

          const salesDelta = getDelta(client.sales, client.previousSales);
          const messagesDelta = getDelta(client.messages, client.previousMessages);
          const cprDelta = getDelta(client.cpr, client.previousCpr);

          const onDownloadReport = () => {
            if (!fullClientData) return;
            const months = Object.keys(fullClientData.months).sort((a, b) => a.localeCompare(b));
            const fileBase = `reporte-${sanitizeFilename(fullClientData.clientName)}`;
            const filename =
              months.length > 1 ? `${fileBase}.csv` : `${fileBase}-${months[0] ?? "sin-mes"}.csv`;
            const csv = generateClientCSV(fullClientData);
            downloadTextFile(filename, csv);
          };

          const onDownloadPdf = () => {
            const url = `/report?client=${encodeURIComponent(client.name)}&month=${encodeURIComponent(activeMonth)}`;
            window.open(url, "_blank", "noopener,noreferrer");
          };

          return (
            <article key={client.name} className="card client-card">
              <div className="client-head">
                <h3>{client.name}</h3>
                <p>{monthLabel}</p>
              </div>
              <StatusPill status={client.status} />
              <div className="mini-kpis mini-kpis-extended">
                <div>
                  <span>Inversión</span>
                  <strong>{formatCop(client.investment)}</strong>
                </div>
                <div>
                  <span>Ventas</span>
                  <strong>{formatCop(client.sales)}</strong>
                </div>
                <div>
                  <span>ROAS</span>
                  <strong>{formatRoas(client.roas)}</strong>
                </div>
                <div>
                  <span>Utilidad</span>
                  <strong>{formatCop(client.estimatedProfit)}</strong>
                </div>
                <div>
                  <span>Mensajes</span>
                  <strong>{client.messages === null ? "—" : client.messages.toLocaleString("es-CO")}</strong>
                </div>
                <div>
                  <span>CPR</span>
                  <strong>{formatCop(client.cpr)}</strong>
                </div>
                <div>
                  <span>Alcance</span>
                  <strong>{client.reach === null ? "—" : client.reach.toLocaleString("es-CO")}</strong>
                </div>
                <div>
                  <span>Impresiones</span>
                  <strong>{client.impressions === null ? "—" : client.impressions.toLocaleString("es-CO")}</strong>
                </div>
              </div>
              <div className="delta-row">
                <span className={getDeltaClass(salesDelta.direction)}>
                  Ventas {previousMonthExists ? formatDeltaText(salesDelta.direction, salesDelta.deltaPercent) : "—"}
                </span>
                <span className={getDeltaClass(messagesDelta.direction)}>
                  Mensajes {previousMonthExists ? formatDeltaText(messagesDelta.direction, messagesDelta.deltaPercent) : "—"}
                </span>
                <span className={getDeltaClass(cprDelta.direction)}>
                  CPR {previousMonthExists ? formatDeltaText(cprDelta.direction, cprDelta.deltaPercent) : "—"}
                </span>
                <span className="delta-neutral">
                  ROAS {previousMonthExists ? formatPercent(client.deltaRoas) : "—"}
                </span>
              </div>
              <div className="client-actions no-print">
                <button type="button" className="client-report-btn" onClick={onDownloadReport}>
                  Descargar reporte
                </button>
                <button type="button" className="client-pdf-btn" onClick={onDownloadPdf}>
                  Descargar PDF
                </button>
              </div>
              <button
                type="button"
                className="client-charts-toggle no-print"
                onClick={() =>
                  setOpenCharts((prev) => ({ ...prev, [client.name]: !isChartsOpen }))
                }
              >
                {isChartsOpen ? "Ocultar gráficas" : "Ver gráficas"}
              </button>
              {isChartsOpen ? <ClientCharts clientName={client.name} data={data} /> : null}
              <div className="client-copy">
                <h4>Diagnóstico ejecutivo</h4>
                <p>{copy.diagnosis}</p>
                <h4>Dirección para el próximo mes</h4>
                <p>{copy.direction}</p>
              </div>
            </article>
          );
        })}
        {visibleClients.length === 0 ? (
          <article className="card empty-state">
            <h3>Sin coincidencias</h3>
            <p>Prueba con otro nombre de cliente para visualizar su ficha ejecutiva.</p>
          </article>
        ) : null}
      </div>
    </section>
  );
}
