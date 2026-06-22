import { PieChart, Pie, Cell } from 'recharts';

export interface DonutSegment {
  name:  string;
  value: number;
  color: string;
}

interface MiniDonutProps {
  data: DonutSegment[];
}

export function MiniDonut({ data }: MiniDonutProps) {
  const hasData = data.length > 0 && data.some((d) => d.value > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {/* Chart */}
      <div style={{ position: 'relative', width: 70, height: 70 }}>
        {hasData ? (
          <PieChart width={70} height={70}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={22}
              outerRadius={34}
              paddingAngle={2}
              isAnimationActive={false}
              startAngle={90}
              endAngle={-270}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        ) : (
          <div style={{
            width: 70, height: 70, borderRadius: '50%',
            border: '2px solid var(--cc-divider)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '0.52rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center', lineHeight: 1.3 }}>
              Sin<br />datos
            </span>
          </div>
        )}
      </div>

      {/* Legend dots */}
      {hasData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
          {data.slice(0, 4).map((seg) => (
            <div key={seg.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: seg.color }} />
              <span style={{
                fontSize: '0.54rem', color: 'var(--color-text-muted)',
                fontFamily: 'JetBrains Mono, monospace',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: 80,
              }}>
                {seg.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
