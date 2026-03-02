import { useMemo } from "react";
import type { ClientMonthlyData } from "../data/months";
import { buildClientSeries } from "../utils/calculations";
import { BarChart } from "./charts/BarChart";
import { LineChart } from "./charts/LineChart";

type ClientChartsProps = {
  clientName: string;
  data: ClientMonthlyData[];
};

export function ClientCharts({ clientName, data }: ClientChartsProps) {
  const series = useMemo(() => buildClientSeries(data, clientName), [clientName, data]);

  return (
    <section className="client-charts-grid">
      <LineChart
        title="Ventas por mes"
        points={series.sales}
        emptyMessage="No hay datos reportados para este gráfico."
      />
      <BarChart
        title="Mensajes por mes"
        points={series.messages}
        emptyMessage="No hay datos reportados para este gráfico."
      />
      <LineChart
        title="CPR por mes"
        points={series.cpr}
        emptyMessage="No hay datos reportados para este gráfico."
      />
    </section>
  );
}
