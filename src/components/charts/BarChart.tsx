import { getMonthLabel } from "../../utils/calculations";

type BarChartPoint = {
  month: string;
  value: number | null;
};

type BarChartProps = {
  title: string;
  points: BarChartPoint[];
  emptyMessage: string;
  valueFormatter?: (value: number) => string;
};

export function BarChart({ title, points, emptyMessage, valueFormatter }: BarChartProps) {
  const validValues = points
    .map((point) => point.value)
    .filter((value): value is number => value !== null && value >= 0);
  const formatValue = valueFormatter ?? ((value: number) => value.toLocaleString("es-CO"));

  if (validValues.length === 0) {
    return (
      <article className="card chart-card">
        <h3>{title}</h3>
        <p className="chart-empty">{emptyMessage}</p>
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
              <span className="bar-value">{point.value === null ? "—" : formatValue(point.value)}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ height: `${Math.max(ratio * 100, 2)}%` }} />
              </div>
              <span className="bar-label">{getMonthLabel(point.month)}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}
