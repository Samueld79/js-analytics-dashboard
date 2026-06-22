import { Link } from 'react-router-dom';
import type { Client } from '../../lib/supabase';
import { formatCop, formatNumber } from '../../lib/utils';
import { StatBadge, type BadgeStatus } from './StatBadge';
import { SparklineChart } from './SparklineChart';
import { ProgressBar } from './ProgressBar';
import { PeriodToggle } from './PeriodToggle';
import { MiniDonut, type DonutSegment } from './MiniDonut';

// ── Public data shape ─────────────────────────────────────────────────────────

export interface ClientCardData {
  client:           Client;
  badge:            BadgeStatus;
  // Sales
  monthlySales:     number;
  daySales:         number;
  weekSales:        number;
  weekDelta:        number | null;
  salesSparkline:   number[];
  // Ads
  monthSpend:       number;
  weekSpend:        number;
  adsImpressions:   number;
  ctr:              number | null;
  cpm:              number | null;
  campaignCount:    number;
  campaignCountPrev: number;
  adSparkline:      number[];
  campaignMix:      DonutSegment[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clientAvatarColor(name: string): string {
  const COLORS = ['#06b6d4','#8b5cf6','#22c55e','#f59e0b','#ef4444','#ec4899','#3b82f6','#10b981'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

function clientInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

const STATUS_LABEL: Record<string, string> = { active: 'Activo', paused: 'Pausado', churned: 'Inactivo' };

const SEP = <div className="client-card-divider" />;

// ── Skeleton card ─────────────────────────────────────────────────────────────

export function ClientCardSkeleton() {
  const block = (w: string, h: number, mt = 0) => (
    <div className="sk-pulse" style={{ width: w, height: h, marginTop: mt }} />
  );
  return (
    <div className="client-card" style={{ padding: 20, gap: 14 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="sk-pulse-slow" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          {block('70%', 12)}
          {block('45%', 8, 6)}
        </div>
      </div>
      <div style={{ height: 1, background: 'var(--cc-divider)' }} />
      {block('100%', 48)}
      <div style={{ height: 1, background: 'var(--cc-divider)' }} />
      {block('100%', 36)}
      <div style={{ height: 1, background: 'var(--cc-divider)' }} />
      {block('100%', 54)}
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export function ClientCard({ data: d }: { data: ClientCardData }) {
  const { client: c } = d;
  const color    = clientAvatarColor(c.name);
  const initials = clientInitials(c.name);

  const campaignDelta  = d.campaignCountPrev > 0 ? d.campaignCount - d.campaignCountPrev : null;
  const hasGoal        = c.monthly_goal != null && c.monthly_goal > 0;
  const hasAds         = d.monthSpend > 0 || d.campaignCount > 0;

  return (
    <Link
      to={`/dashboard/cliente/${c.id}`}
      style={{ textDecoration: 'none', display: 'block', height: '100%' }}
      aria-label={`Ver perfil de ${c.name}`}
    >
      <div className="client-card">

        {/* ── Header ── */}
        <div style={{ padding: '16px 18px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div
            aria-hidden="true"
            style={{
              width: 48, height: 48, borderRadius: 12, flexShrink: 0,
              background: color + '22', border: `2px solid ${color}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', fontWeight: 800, color,
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            {initials}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif', lineHeight: 1.2 }}>
                {c.name}
              </span>
              <StatBadge status={d.badge} />
            </div>
            <div style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              {c.niche ?? '—'} · {STATUS_LABEL[c.status] ?? c.status}
            </div>
          </div>
        </div>

        {SEP}

        {/* ── Campañas activas + sparkline ── */}
        <div style={{ padding: '12px 18px' }}>
          <p style={{ margin: '0 0 6px', fontSize: '0.52rem', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.12em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Campañas activas
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <span style={{ fontSize: '2.1rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: 'var(--color-text-primary)', lineHeight: 1, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
                {d.campaignCount > 0 ? d.campaignCount : '—'}
              </span>
              {campaignDelta !== null && (
                <p style={{ margin: '3px 0 0', fontSize: '0.58rem', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: campaignDelta >= 0 ? '#22c55e' : '#ef4444' }}>
                  {campaignDelta >= 0 ? '↑' : '↓'} {Math.abs(campaignDelta)} {Math.abs(campaignDelta) === 1 ? 'campaña' : 'campañas'} vs mes ant.
                </p>
              )}
            </div>
            {d.adSparkline.some((v) => v > 0) && (
              <div style={{ flex: 1, maxWidth: 120 }}>
                <SparklineChart data={d.adSparkline} color="var(--cc-accent)" width={120} height={48} filled />
              </div>
            )}
          </div>
        </div>

        {SEP}

        {/* ── PeriodToggle: DÍA / SEMANA ── */}
        <div style={{ padding: '12px 18px' }}>
          <PeriodToggle
            dayValue={d.daySales}
            weekValue={d.weekSales}
            weekDelta={d.weekDelta}
          />
        </div>

        {SEP}

        {/* ── Meta mensual ── */}
        <div style={{ padding: '12px 18px' }}>
          {hasGoal ? (
            <ProgressBar current={d.monthlySales} target={c.monthly_goal!} />
          ) : (
            <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              Sin meta definida
            </span>
          )}
        </div>

        {SEP}

        {/* ── Mix inversión + stats de ads ── */}
        <div style={{ padding: '12px 18px' }}>
          <p style={{ margin: '0 0 10px', fontSize: '0.52rem', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.12em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Ads del mes
          </p>
          {hasAds ? (
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              {/* Donut */}
              <div style={{ flexShrink: 0 }}>
                <MiniDonut data={d.campaignMix} />
              </div>

              {/* Stats column */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[
                  { icon: '💰', label: 'Inversión', value: formatCop(d.monthSpend) },
                  { icon: '📊', label: 'CTR',        value: d.ctr   != null ? `${d.ctr.toFixed(2)}%` : null },
                  { icon: '📈', label: 'CPM',        value: d.cpm   != null ? formatCop(d.cpm)        : null },
                  { icon: '👁',  label: 'Impr.',      value: d.adsImpressions > 0 ? formatNumber(d.adsImpressions) : null },
                ].filter((row) => row.value !== null).map((row) => (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.7rem', lineHeight: 1, flexShrink: 0 }}>{row.icon}</span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
                      {row.label}:
                    </span>
                    <span style={{ fontSize: '0.64rem', fontWeight: 600, color: 'var(--color-text-secondary)', fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              Sin actividad en ads
            </span>
          )}
        </div>

        {SEP}

        {/* ── CTA ── */}
        <div style={{
          marginTop: 'auto',
          padding: '11px 18px',
          textAlign: 'center',
          fontSize: '0.7rem', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
          color: 'var(--color-text-muted)', letterSpacing: '0.05em',
        }}>
          Ver perfil completo →
        </div>

      </div>
    </Link>
  );
}
