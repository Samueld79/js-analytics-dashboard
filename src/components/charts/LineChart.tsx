import { getMonthLabel } from "../../utils/calculations";

type LineChartPoint = {
  month: string;
  value: number | null;
};

type LineChartProps = {
  title: string;
  points: LineChartPoint[];
  emptyMessage: string;
  valueFormatter?: (value: number) => string;
};

export function LineChart({ title, points, emptyMessage, valueFormatter }: LineChartProps) {
  const validPoints = points
    .map((point, index) => ({ ...point, index }))
    .filter((point) => point.value !== null) as Array<LineChartPoint & { index: number; value: number }>;

  if (validPoints.length === 0) {
    return (
      <article className="card chart-card">
        <h3>{title}</h3>
        <p className="chart-empty">{emptyMessage}</p>
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
  const formatValue = valueFormatter ?? ((value: number) => value.toLocaleString("es-CO"));

  const pathData =
    validPoints.length >= 2
      ? validPoints
          .map((point, idx) => `${idx === 0 ? "M" : "L"}${toX(point.index)} ${toY(point.value)}`)
          .join(" ")
      : "";

  return (
    <article className="card chart-card">
      <h3>{title}</h3>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <line
          x1={paddingX}
          y1={height - paddingY}
          x2={width - paddingX}
          y2={height - paddingY}
          className="chart-axis"
        />
        {pathData ? <path d={pathData} className="line-path" /> : null}
        {validPoints.map((point) => {
          const x = toX(point.index);
          const y = toY(point.value);
          const labelOffset = y <= paddingY + 14 ? 14 : -10;
          const labelY = y + labelOffset;
          const textAnchor = x <= paddingX + 26 ? "start" : x >= width - paddingX - 26 ? "end" : "middle";
          const labelX = textAnchor === "start" ? x + 4 : textAnchor === "end" ? x - 4 : x;

          return (
            <g key={`${point.month}-${point.index}`}>
              <circle cx={x} cy={y} r="4" className="line-point" />
              <text x={labelX} y={labelY} textAnchor={textAnchor} className="chart-value-label">
                {formatValue(point.value)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="chart-labels">
        {points.map((point) => (
          <span key={point.month}>{getMonthLabel(point.month)}</span>
        ))}
      </div>
    </article>
  );
}
