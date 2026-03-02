import { useMemo } from "react";
import type { ClientMonthlyData } from "../data/months";
import { buildClientChartSeries, getClientByName } from "../utils/calculations";
import { BarChart } from "./charts/BarChart";
import { LineChart } from "./charts/LineChart";

type ClientChartsProps = {
  clientName: string;
  data: ClientMonthlyData[];
};

export function ClientCharts({ clientName, data }: ClientChartsProps) {
  const chartSeries = useMemo(() => {
    const client = getClientByName(data, clientName);
    if (!client) {
      return {
        salesPoints: [],
        messagesPoints: [],
        cprPoints: [],
      };
    }
    return buildClientChartSeries(client);
  }, [clientName, data]);

  return (
    <section className="client-charts-wrap">
      <div className="client-charts-grid">
        <LineChart
          title="Ventas por mes"
          points={chartSeries.salesPoints}
          emptyMessage="No hay datos reportados para este gráfico."
        />
        <BarChart
          title="Mensajes por mes"
          points={chartSeries.messagesPoints}
          emptyMessage="No hay datos reportados para este gráfico."
        />
        <LineChart
          title="CPR por mes"
          points={chartSeries.cprPoints}
          emptyMessage="No hay datos reportados para este gráfico."
        />
      </div>
    </section>
  );
}
