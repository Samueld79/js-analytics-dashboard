import { useState, useMemo, useId } from 'react';
import { MoreHorizontal, Lightbulb, ShoppingCart } from 'lucide-react';
import './competitor-tokens.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Product {
  name:  string;
  value: string;
  color: string;
}

interface Competitor {
  name:    string;
  url:     string;
  initial: string;
  accent:  string;
  shopAds: { value: number; delta: string; trend: 'up' | 'down' | 'flat'; series: number[] | null };
  revenue: { day: string; dayDelta: string; week: string; weekDelta: string; series: number[] | null };
  social:  { fb: string; fbDelta: string; ig: string; igDelta: string };
  meta:    { country: string; sku: number; currency: string };
  tab:     'ads' | 'revenue';
  products: Product[];
}

// ── Static data ───────────────────────────────────────────────────────────────

const COMPETITORS: Competitor[] = [
  {
    name:    'FHI Heat™ | Where Innovation Meets …',
    url:     'www.fhiheat.com',
    initial: 'F',
    accent:  '#EF4444',
    shopAds: { value: 89, delta: '+13 (+17.1%)', trend: 'up', series: [60, 62, 61, 63, 68, 72, 85, 89] },
    revenue: { day: '$58K', dayDelta: '-83 (-0.1%)', week: '$428K', weekDelta: '-78K (-15.3%)', series: [40, 55, 48, 60, 52, 70, 58, 65] },
    social:  { fb: '70K', fbDelta: '+97 (+0.1%)', ig: '114K', igDelta: '+26 (-)' },
    meta:    { country: 'US', sku: 139, currency: 'USD' },
    tab:     'ads',
    products: [{ name: 'The VersaSphere Pro Air 6-I…', value: '1 (-)', color: '#22D3EE' }],
  },
  {
    name:    'The It Styler | Cordless Hair Styler To-…',
    url:     'theitstyler.com',
    initial: 'Y',
    accent:  '#F59E0B',
    shopAds: { value: 0, delta: '0', trend: 'flat', series: null },
    revenue: { day: '$1401.00', dayDelta: '+184 (+15.1%)', week: '$11K', weekDelta: '-5560 (-32.4%)', series: [20, 25, 22, 80, 30, 28, 26, 24] },
    social:  { fb: 'N/A', fbDelta: '', ig: 'N/A', igDelta: '' },
    meta:    { country: 'US', sku: 7, currency: 'USD' },
    tab:     'revenue',
    products: [
      { name: 'The It Styler™ - Perfect Hair …', value: '6888 (-2646)', color: '#22D3EE' },
      { name: 'The It Styler™ Luxe',             value: '1556 (-3004)', color: '#10B981' },
      { name: 'The It Pocket Styler™',            value: '1134 (+546)',  color: '#A78BFA' },
    ],
  },
  {
    name:    "L'ange Hair - Hair Styling Tools & Hair …",
    url:     'langehair.com',
    initial: 'L',
    accent:  '#A78BFA',
    shopAds: { value: 0, delta: '0', trend: 'flat', series: null },
    revenue: { day: '$12K', dayDelta: '-1593.3 (-11.1%)', week: '$53K', weekDelta: '+27K (+102.9%)', series: [10, 12, 11, 14, 13, 40, 55, 53] },
    social:  { fb: 'N/A', fbDelta: '', ig: 'N/A', igDelta: '' },
    meta:    { country: 'US', sku: 132, currency: 'USD' },
    tab:     'revenue',
    products: [
      { name: 'Ms. Bond System',           value: '32K (-)',          color: '#22D3EE' },
      { name: 'Alligator Hair Clips',      value: '7175.7 (-2838.1)', color: '#10B981' },
      { name: 'Siena Flexi Vented Brush',  value: '6009.8 (-1223.8)', color: '#A78BFA' },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseLeadingNumber(s: string): number {
  const m = s.match(/^(\d[\d,]*(?:\.\d+)?)(K|M)?/i);
  if (!m) return 1;
  const n = parseFloat(m[1].replace(',', ''));
  const mult = m[2]?.toUpperCase() === 'K' ? 1_000 : m[2]?.toUpperCase() === 'M' ? 1_000_000 : 1;
  return n * mult;
}

type DeltaSign = 'pos' | 'neg' | 'flat';

function signOf(v: string): DeltaSign {
  if (!v || v === '0') return 'flat';
  return v[0] === '+' ? 'pos' : v[0] === '-' ? 'neg' : 'flat';
}

// ── Atoms ─────────────────────────────────────────────────────────────────────

function Delta({ value }: { value: string }) {
  if (!value || value === '0') {
    return <span style={{ color: 'var(--ca-muted)', fontSize: '0.68rem' }}>→ 0</span>;
  }
  const sign = signOf(value);
  const color = sign === 'pos' ? 'var(--ca-success)' : sign === 'neg' ? 'var(--ca-danger)' : 'var(--ca-muted)';
  const arrow = sign === 'pos' ? '↑' : sign === 'neg' ? '↓' : '→';
  return (
    <span style={{ color, fontSize: '0.68rem', lineHeight: 1.4 }}>
      {arrow} {value}
    </span>
  );
}

function ProductValue({ value }: { value: string }) {
  const m = value.match(/^(.+?)\s*\(([^)]*)\)$/);
  if (!m) {
    return <span style={{ color: 'var(--ca-muted)', fontSize: '0.68rem' }}>{value}</span>;
  }
  const main = m[1].trim();
  const delta = m[2].trim();
  const dc = delta.startsWith('+') ? 'var(--ca-success)' : delta.startsWith('-') ? 'var(--ca-danger)' : 'var(--ca-muted)';
  return (
    <span style={{ fontSize: '0.68rem' }}>
      <span style={{ color: 'var(--ca-fg)' }}>{main}</span>{' '}
      <span style={{ color: dc }}>({delta})</span>
    </span>
  );
}

function SocialBadge({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 14,
        borderRadius: 3,
        fontSize: '0.5rem',
        fontWeight: 800,
        letterSpacing: '0.04em',
        background: 'rgba(255,255,255,0.08)',
        color: 'var(--ca-muted)',
      }}
    >
      {label}
    </span>
  );
}

// ── Sparkline (SVG) ───────────────────────────────────────────────────────────

interface SparklineProps {
  series: number[] | null;
  color?: string;
  width?: number;
  height?: number;
}

function Sparkline({ series, color = 'var(--ca-accent)', width = 84, height = 40 }: SparklineProps) {
  const uid = useId().replace(/:/g, '_');

  if (!series || series.length < 2) {
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ca-muted)',
          fontSize: '0.58rem',
          opacity: 0.55,
          fontFamily: 'Geist Mono, JetBrains Mono, monospace',
        }}
        aria-hidden="true"
      >
        No Chart
      </div>
    );
  }

  const pad = 2;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const usableW = width - pad * 2;
  const usableH = height - pad * 2;

  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * usableW + pad;
    const y = usableH - ((v - min) / range) * usableH + pad;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const linePts  = pts.join(' ');
  const areaPath = [
    `${pad},${usableH + pad}`,
    ...pts,
    `${usableW + pad},${usableH + pad}`,
  ].join(' ');

  const gradId = `ca-sg-${uid}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Trend sparkline"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPath} fill={`url(#${gradId})`} />
      <polyline
        points={linePts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Donut chart (SVG) ─────────────────────────────────────────────────────────

function Donut({ products, size = 80 }: { products: Product[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 3;
  const innerR = size / 2 - 14;
  const midR   = (outerR + innerR) / 2;
  const strokeW = outerR - innerR;

  const arcs = useMemo(() => {
    const vals  = products.map((p) => parseLeadingNumber(p.value));
    const total = vals.reduce((s, v) => s + v, 0) || 1;
    let angle = -Math.PI / 2;
    return products.map((p, i) => {
      const sweep = (vals[i] / total) * 2 * Math.PI;
      const start = angle;
      angle += sweep;
      return { start, end: angle, sweep, color: p.color };
    });
  }, [products]);

  if (!products.length) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Product share donut"
    >
      {arcs.length === 1 ? (
        <circle cx={cx} cy={cy} r={midR} fill="none" stroke={arcs[0].color} strokeWidth={strokeW} />
      ) : (
        arcs.map((arc, i) => {
          const large = arc.sweep > Math.PI ? 1 : 0;
          const x1  = cx + outerR * Math.cos(arc.start);
          const y1  = cy + outerR * Math.sin(arc.start);
          const x2  = cx + outerR * Math.cos(arc.end);
          const y2  = cy + outerR * Math.sin(arc.end);
          const ix1 = cx + innerR * Math.cos(arc.end);
          const iy1 = cy + innerR * Math.sin(arc.end);
          const ix2 = cx + innerR * Math.cos(arc.start);
          const iy2 = cy + innerR * Math.sin(arc.start);
          const d = [
            `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
            `A ${outerR} ${outerR} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
            `L ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
            `A ${innerR} ${innerR} 0 ${large} 0 ${ix2.toFixed(2)} ${iy2.toFixed(2)}`,
            'Z',
          ].join(' ');
          return <path key={i} d={d} fill={arc.color} />;
        })
      )}
      <text
        x={cx}
        y={cy - 3}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="5.5"
        fontFamily="Geist Mono, JetBrains Mono, monospace"
        fill="var(--ca-muted)"
        letterSpacing="0.05em"
      >
        CURRENT
      </text>
    </svg>
  );
}

// ── StatBlock ─────────────────────────────────────────────────────────────────

function StatBlock({
  label,
  value,
  delta,
  prefix,
}: {
  label:   string;
  value:   string | number;
  delta?:  string;
  prefix?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: '0.58rem',
          color: 'var(--ca-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.09em',
          fontWeight: 600,
        }}
      >
        {prefix && <SocialBadge label={prefix} />}
        {label}
      </span>
      <span
        style={{
          fontSize: '1.05rem',
          fontWeight: 700,
          color: 'var(--ca-fg)',
          lineHeight: 1.2,
          letterSpacing: '-0.01em',
          fontFamily: 'Geist Mono, JetBrains Mono, monospace',
        }}
      >
        {value}
      </span>
      {delta !== undefined && delta !== '' && <Delta value={delta} />}
    </div>
  );
}

// ── CompetitorCard ────────────────────────────────────────────────────────────

function CompetitorCard({ competitor: c }: { competitor: Competitor }) {
  const [tab, setTab] = useState<'ads' | 'revenue'>(c.tab);

  const sep = { height: 1, background: 'var(--ca-border)', flexShrink: 0 } as const;

  return (
    <article
      className="ca-card"
      aria-label={`Competidor: ${c.name}`}
      style={{
        width: 360,
        minWidth: 300,
        flexShrink: 0,
        scrollSnapAlign: 'start',
        background: 'var(--ca-panel)',
        border: '1px solid var(--ca-border)',
        borderRadius: 'var(--ca-r-lg)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = 'var(--ca-border-hover)';
        el.style.boxShadow   = 'var(--ca-shadow-card)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = 'var(--ca-border)';
        el.style.boxShadow   = 'none';
      }}
    >
      {/* ── a: Header ── */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          aria-hidden="true"
          style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            background: `${c.accent}22`,
            border:     `2px solid ${c.accent}55`,
            display:    'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1rem', fontWeight: 800, color: c.accent,
          }}
        >
          {c.initial}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              margin: 0, fontSize: '0.82rem', fontWeight: 600, color: 'var(--ca-fg)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3,
            }}
          >
            {c.name}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '0.68rem', color: 'var(--ca-muted)' }}>
            {c.url}
          </p>
        </div>
        <button
          aria-label={`Opciones para ${c.name}`}
          aria-haspopup="menu"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--ca-muted)', padding: 4, borderRadius: 'var(--ca-r-sm)',
            display: 'flex', alignItems: 'center', flexShrink: 0,
            transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ca-fg)'; e.currentTarget.style.background = 'var(--ca-border)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ca-muted)'; e.currentTarget.style.background = 'transparent'; }}
          onFocus={(e)      => { e.currentTarget.style.outline = '2px solid var(--ca-accent)'; }}
          onBlur={(e)       => { e.currentTarget.style.outline = 'none'; }}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      <div style={sep} />

      {/* ── b: Shop Ads ── */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.62rem', color: 'var(--ca-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 600 }}>
            <ShoppingCart size={11} />
            Shop Ads
          </span>
          <span style={{
            fontSize: '0.56rem', fontWeight: 700, padding: '2px 9px',
            borderRadius: 'var(--ca-r-full)',
            background: 'var(--ca-accent-subtle)', color: 'var(--ca-accent)',
            border: '1px solid var(--ca-accent-subtle-ring)', letterSpacing: '0.05em',
          }}>
            30d
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 3px', fontSize: '2.2rem', fontWeight: 800, color: 'var(--ca-fg)', lineHeight: 1, letterSpacing: '-0.04em', fontFamily: 'Geist Mono, JetBrains Mono, monospace' }}>
              {c.shopAds.value}
            </p>
            <Delta value={c.shopAds.delta} />
          </div>
          <Sparkline series={c.shopAds.series} color="var(--ca-accent)" width={88} height={42} />
        </div>
      </div>

      <div style={sep} />

      {/* ── c: Revenue Day / Week ── */}
      <div style={{ padding: '12px 16px' }}>
        <p style={{ margin: '0 0 8px', fontSize: '0.62rem', color: 'var(--ca-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 600 }}>
          Revenue
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flex: 1 }}>
            <StatBlock label="Day"  value={c.revenue.day}  delta={c.revenue.dayDelta} />
            <StatBlock label="Week" value={c.revenue.week} delta={c.revenue.weekDelta} />
          </div>
          <div style={{ flexShrink: 0 }}>
            <Sparkline series={c.revenue.series} color="var(--ca-accent)" width={72} height={46} />
          </div>
        </div>
      </div>

      <div style={sep} />

      {/* ── d: Social ── */}
      <div style={{ padding: '12px 16px' }}>
        <p style={{ margin: '0 0 8px', fontSize: '0.62rem', color: 'var(--ca-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 600 }}>
          Social
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <StatBlock label="Followers" value={c.social.fb} delta={c.social.fbDelta || undefined} prefix="FB" />
          <StatBlock label="Followers" value={c.social.ig} delta={c.social.igDelta || undefined} prefix="IG" />
        </div>
      </div>

      <div style={sep} />

      {/* ── e: Meta info ── */}
      <div style={{ padding: '10px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          <StatBlock label="Country"  value={c.meta.country}  />
          <StatBlock label="SKUs"     value={c.meta.sku}      />
          <StatBlock label="Currency" value={c.meta.currency} />
        </div>
      </div>

      <div style={sep} />

      {/* ── f: Tabs + g: Products ── */}
      <div style={{ padding: '12px 16px 16px' }}>
        {/* Pill tab toggle */}
        <div
          role="tablist"
          aria-label="Vista de productos"
          style={{ display: 'inline-flex', gap: 2, padding: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--ca-r-full)', marginBottom: 10 }}
        >
          {(['ads', 'revenue'] as const).map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                role="tab"
                aria-selected={active}
                aria-controls={`ca-panel-${t}`}
                onClick={() => setTab(t)}
                style={{
                  padding: '4px 14px', border: 'none', cursor: 'pointer',
                  borderRadius: 'var(--ca-r-full)',
                  fontSize: '0.63rem', fontWeight: 700, letterSpacing: '0.04em',
                  textTransform: 'capitalize', transition: 'all 0.15s ease',
                  background: active ? 'var(--ca-gradient-primary)' : 'transparent',
                  color: active ? 'white' : 'var(--ca-muted)',
                  outline: 'none',
                }}
                onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--ca-accent)'; }}
                onBlur={(e)  => { e.currentTarget.style.boxShadow = 'none'; }}
              >
                {t === 'ads' ? 'Ads' : 'Revenue'}
              </button>
            );
          })}
        </div>

        <p style={{ margin: '0 0 10px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--ca-fg)', letterSpacing: '-0.01em' }}>
          {tab === 'ads' ? 'Top Advertised Products' : 'Top Revenue Producers'}
        </p>

        <div
          id={`ca-panel-${tab}`}
          role="tabpanel"
          style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}
        >
          {/* Product list */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {c.products.slice(0, 3).map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div
                  aria-hidden="true"
                  style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, flexShrink: 0, marginTop: 4 }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: '0 0 1px', fontSize: '0.7rem', fontWeight: 500, color: 'var(--ca-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name}
                  </p>
                  <ProductValue value={p.value} />
                </div>
              </div>
            ))}
          </div>

          {/* Donut */}
          <div style={{ flexShrink: 0 }}>
            <Donut products={c.products} size={80} />
          </div>
        </div>
      </div>
    </article>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CompetitorAnalysis() {
  return (
    <section
      className="ca-root"
      aria-label="Competitor Analysis"
      style={{ padding: '4px 0' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Lightbulb size={18} aria-hidden="true" style={{ color: 'var(--ca-warning)', flexShrink: 0 }} />
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--ca-fg)', letterSpacing: '-0.01em' }}>
            Competitor Analysis
          </h2>
        </div>
        <button
          aria-label="Ver más competidores"
          style={{
            background: 'var(--ca-gradient-primary)', border: 'none', cursor: 'pointer',
            borderRadius: 'var(--ca-r-full)', padding: '6px 18px',
            color: 'white', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.02em',
            transition: 'opacity 0.15s ease, transform 0.15s ease',
            outline: 'none',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1';    e.currentTarget.style.transform = 'translateY(0)'; }}
          onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 3px var(--ca-accent)'; }}
          onBlur={(e)  => { e.currentTarget.style.boxShadow = 'none'; }}
        >
          See More
        </button>
      </div>

      {/* Horizontal carousel */}
      <div
        className="ca-carousel"
        role="list"
        aria-label="Tarjetas de competidores"
        style={{
          display:          'flex',
          gap:              16,
          overflowX:        'auto',
          scrollSnapType:   'x mandatory',
          paddingBottom:    12,
          paddingRight:     40,
        }}
      >
        {COMPETITORS.map((c) => (
          <div key={c.url} role="listitem">
            <CompetitorCard competitor={c} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default CompetitorAnalysis;
