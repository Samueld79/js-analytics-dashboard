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
  const formatRoasPoint = (value: number) => `${value.toFixed(2)}x`;

  const chartData = useMemo(() => {
    const client = getClientByName(data, clientName);
    if (!client) {
      return {
        salesPoints: [],
        messagesPoints: [],
        roasPoints: [],
        avgConversationCostPoints: [],
        latestSummary: {
          sales: null as number | null,
          messages: null as number | null,
          avgConversationCost: null as number | null,
          roas: null as number | null,
        },
      };
    }

    const months = getSortedMonthsForClient(client);
    const chartSeries = buildClientChartSeries(client);
    const latestMonth = months[months.length - 1];
    const latest = latestMonth ? client.months[latestMonth] : null;
    const avgConversationCost =
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
        avgConversationCost,
        roas,
      },
    };
  }, [clientName, data]);

  return (
    <section className="client-charts-wrap">
      <div className="client-charts-header">
        <h4>Comparativo mensual por cliente</h4>
      </div>
      <div className="client-charts-primary">
        <LineChart
          title="Ventas por mes"
          points={chartData.salesPoints}
          emptyMessage="No hay datos reportados para este gráfico."
          valueFormatter={formatCop}
        />
      </div>
      <div className="client-charts-mini-grid">
        <BarChart
          title="Mensajes por mes"
          points={chartData.messagesPoints}
          emptyMessage="No hay datos reportados para este gráfico."
        />
        <LineChart
          title="ROAS por mes"
          points={chartData.roasPoints}
          emptyMessage="No hay datos reportados para este gráfico."
          valueFormatter={formatRoasPoint}
        />
        <div className="client-chart-with-note">
          <LineChart
            title="Costo promedio por conversación por mes"
            points={chartData.avgConversationCostPoints}
            emptyMessage="No hay datos reportados para este gráfico."
            valueFormatter={formatCop}
          />
          <p className="chart-note">
            Calculado como inversión total / mensajes. No atribuye inversión exclusiva a campañas de mensajes.
          </p>
        </div>
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
          <span>Costo promedio por conversación (último mes)</span>
          <strong>{formatCop(chartData.latestSummary.avgConversationCost)}</strong>
        </div>
        <div>
          <span>ROAS (último mes)</span>
          <strong>{formatRoas(chartData.latestSummary.roas)}</strong>
        </div>
      </div>
    </section>
  );
}
