import { getMonthLabel } from "../../utils/calculations";

type LineChartPoint = {
  month: string;
  value: number | null;
};

type LineChartProps = {
  title: string;
  points: LineChartPoint[];
  emptyMessage: string;
};

export function LineChart({ title, points, emptyMessage }: LineChartProps) {
  if (points.length < 2) {
    return (
      <article className="card chart-card">
        <h3>{title}</h3>
        <p className="chart-empty">{emptyMessage}</p>
      </article>
    );
  }

  const validPoints = points
    .map((point, index) => ({ ...point, index }))
    .filter((point) => point.value !== null) as Array<LineChartPoint & { index: number; value: number }>;

  if (validPoints.length < 2) {
    return (
      <article className="card chart-card">
        <h3>{title}</h3>
        <p className="chart-empty">No hay suficientes datos reportados para este gráfico.</p>
      </article>
    );
  }

  const width = 640;
  const height = 220;
  const paddingX = 42;
  const paddingY = 28;
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingY * 2;

  const minValue = Math.min(...validPoints.map((point) => point.value));
  const maxValue = Math.max(...validPoints.map((point) => point.value));
  const span = maxValue - minValue || 1;

  const toX = (index: number) =>
    paddingX + (index / Math.max(points.length - 1, 1)) * usableWidth;
  const toY = (value: number) => paddingY + usableHeight - ((value - minValue) / span) * usableHeight;

  const pathData = validPoints
    .map((point, idx) => `${idx === 0 ? "M" : "L"}${toX(point.index)} ${toY(point.value)}`)
    .join(" ");

  return (
    <article className="card chart-card">
      <h3>{title}</h3>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} className="chart-axis" />
        <path d={pathData} className="line-path" />
        {validPoints.map((point) => (
          <circle
            key={`${point.month}-${point.index}`}
            cx={toX(point.index)}
            cy={toY(point.value)}
            r="4"
            className="line-point"
          />
        ))}
      </svg>
      <div className="chart-labels">
        {points.map((point) => (
          <span key={point.month}>{getMonthLabel(point.month)}</span>
        ))}
      </div>
    </article>
  );
}
