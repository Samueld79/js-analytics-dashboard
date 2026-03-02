import { getMonthLabel } from "../../utils/calculations";

type BarChartPoint = {
  month: string;
  value: number | null;
};

type BarChartProps = {
  title: string;
  points: BarChartPoint[];
  emptyMessage: string;
};

export function BarChart({ title, points }: BarChartProps) {
  const validValues = points
    .map((point) => point.value)
    .filter((value): value is number => value !== null && value >= 0);

  if (validValues.length === 0) {
    return (
      <article className="card chart-card">
        <h3>{title}</h3>
        <p className="chart-empty">No hay datos reportados para este gráfico.</p>
      </article>
    );
  }

  const maxValue = Math.max(...validValues, 1);

  return (
    <article className="card chart-card">
      <h3>{title}</h3>
      <div className="bar-chart">
        {points.map((point) => {
          const ratio = point.value === null ? 0 : point.value / maxValue;
          return (
            <div className="bar-col" key={point.month}>
              <div className="bar-track">
                <div className="bar-fill" style={{ height: `${Math.max(ratio * 100, 2)}%` }} />
              </div>
              <span className="bar-value">{point.value === null ? "—" : point.value.toLocaleString("es-CO")}</span>
              <span className="bar-label">{getMonthLabel(point.month)}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}
