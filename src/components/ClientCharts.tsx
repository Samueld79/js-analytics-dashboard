import { useMemo } from "react";
import type { ClientMonthlyData } from "../data/months";
import { buildClientChartSeries, formatCop, formatInteger, formatRoas, getClientByName, getSortedMonthsForClient } from "../utils/calculations";
import { BarChart } from "./charts/BarChart";
import { LineChart } from "./charts/LineChart";

type ClientChartsProps = {
  clientName: string;
  data: ClientMonthlyData[];
};

export function ClientCharts({ clientName, data }: ClientChartsProps) {
  const chartData = useMemo(() => {
    const client = getClientByName(data, clientName);
    if (!client) {
      return {
        salesPoints: [],
        messagesPoints: [],
        cprPoints: [],
        latestSummary: {
          sales: null as number | null,
          messages: null as number | null,
          cpr: null as number | null,
          roas: null as number | null,
        },
      };
    }

    const months = getSortedMonthsForClient(client);
    const chartSeries = buildClientChartSeries(client);
    const latestMonth = months[months.length - 1];
    const latest = latestMonth ? client.months[latestMonth] : null;
    const cpr =
      !latest || latest.messages === null || latest.messages === 0
        ? null
        : latest.investment / latest.messages;
    const roas =
      !latest || latest.sales === null || latest.investment === 0
        ? null
        : latest.sales / latest.investment;

    return {
      ...chartSeries,
      latestSummary: {
        sales: latest?.sales ?? null,
        messages: latest?.messages ?? null,
        cpr,
        roas,
      },
    };
  }, [clientName, data]);

  return (
    <section className="client-charts-wrap">
      <div className="client-charts-header">
        <h4>Comparativo Ventas vs Mensajes</h4>
      </div>
      <div className="client-charts-grid">
        <LineChart
          title="Ventas por mes"
          points={chartData.salesPoints}
          emptyMessage="No hay datos reportados para este gráfico."
          valueFormatter={formatCop}
        />
        <BarChart
          title="Mensajes por mes"
          points={chartData.messagesPoints}
          emptyMessage="No hay datos reportados para este gráfico."
        />
      </div>
      <div className="client-charts-summary">
        <div>
          <span>Ventas (último mes)</span>
          <strong>{formatCop(chartData.latestSummary.sales)}</strong>
        </div>
        <div>
          <span>Mensajes (último mes)</span>
          <strong>{formatInteger(chartData.latestSummary.messages)}</strong>
        </div>
        <div>
          <span>CPR (último mes)</span>
          <strong>{formatCop(chartData.latestSummary.cpr)}</strong>
        </div>
        <div>
          <span>ROAS (último mes)</span>
          <strong>{formatRoas(chartData.latestSummary.roas)}</strong>
        </div>
      </div>
      <div className="client-cpr-chart">
        <LineChart
          title="CPR por mes"
          points={chartData.cprPoints}
          emptyMessage="No hay datos reportados para este gráfico."
          valueFormatter={formatCop}
        />
      </div>
    </section>
  );
}
