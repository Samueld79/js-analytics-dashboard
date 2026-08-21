import { useEffect, useState } from 'react';
import { Smile } from 'lucide-react';
import { SparklineChart } from './dashboard/SparklineChart';
import { listPulseResponses } from '../services/pulse';
import { PULSE_MOOD_EMOJI, type PulseResponse } from '../lib/supabase';
import { formatCop } from '../lib/utils';

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function previousMonthKey(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Internal-team-only card: recent mood + 6-month trend + top improve tags for
// this client, plus a small sales snapshot (daily_sales) alongside it. Must
// never render on the public /portal/:id — caller gates this behind
// isInternal && !portalMode.
export function ClientSatisfactionCard({
  clientId,
  salesByMonth,
}: {
  clientId: string;
  salesByMonth: Map<string, number>;
}) {
  const [responses, setResponses] = useState<PulseResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listPulseResponses(clientId).then((rows) => {
      setResponses(rows);
      setLoading(false);
    });
  }, [clientId]);

  if (loading) {
    return (
      <div className="card-glass card-padded" style={{ minHeight: 120 }} />
    );
  }

  const sorted = [...responses].sort((a, b) => a.month.localeCompare(b.month));
  const latest = sorted[sorted.length - 1] ?? null;
  const last6 = sorted.slice(-6);

  const improveTagCounts = new Map<string, number>();
  responses.forEach((r) => {
    r.improve_tags.forEach((tag) => improveTagCounts.set(tag, (improveTagCounts.get(tag) ?? 0) + 1));
  });
  const topImproveTags = [...improveTagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);

  const curSales = salesByMonth.get(currentMonthKey());
  const prevSales = salesByMonth.get(previousMonthKey());
  const salesDelta = curSales != null && prevSales != null && prevSales > 0
    ? ((curSales - prevSales) / prevSales) * 100
    : null;

  return (
    <div className="card-glass card-padded" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div>
        <div className="number-label" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Smile size={12} /> Satisfacción
        </div>

        {!latest ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', margin: 0 }}>Sin respuestas de Pulso todavía.</p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: '1.8rem' }}>{PULSE_MOOD_EMOJI[latest.mood_label]}</span>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--fg)' }}>{latest.mood_label}</div>
                <div style={{ fontSize: '0.66rem', color: 'var(--fg-muted)' }}>
                  {new Date(`${latest.month}T00:00:00`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                </div>
              </div>
            </div>

            {last6.length >= 2 && (
              <SparklineChart data={last6.map((r) => r.mood_score)} width={140} height={32} color="var(--cyan)" />
            )}

            {topImproveTags.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--fg-muted)', marginBottom: 4 }}>Más pedido para mejorar</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {topImproveTags.map((tag) => (
                    <span key={tag} style={{ fontSize: '0.66rem', padding: '2px 8px', borderRadius: 4, background: 'var(--warning-dim)', color: 'var(--warning)' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 20 }}>
        <div className="number-label" style={{ marginBottom: 10 }}>Ventas del mes</div>
        {curSales == null ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', margin: 0 }}>Sin reporte de ventas</p>
        ) : (
          <>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--fg)', fontFamily: 'JetBrains Mono, monospace' }}>
              {formatCop(curSales)}
            </div>
            <div style={{ fontSize: '0.7rem', color: salesDelta == null ? 'var(--fg-muted)' : salesDelta >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: 2 }}>
              {salesDelta == null ? 'Sin mes anterior para comparar' : `${salesDelta >= 0 ? '↑' : '↓'} ${Math.abs(salesDelta).toFixed(1)}% vs mes anterior`}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
