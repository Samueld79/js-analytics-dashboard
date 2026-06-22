import { motion, type Transition } from 'framer-motion';

export type BadgeStatus = 'objetivo' | 'riesgo' | 'accion' | 'inactivo';

const MAP: Record<BadgeStatus, { label: string; color: string; bg: string; border: string; pulse?: true }> = {
  objetivo: { label: 'En objetivo',      color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.28)' },
  riesgo:   { label: 'En riesgo',        color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.28)' },
  accion:   { label: 'Acción inmediata', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.28)', pulse: true },
  inactivo: { label: 'Sin actividad',    color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.2)' },
};

export function StatBadge({ status }: { status: BadgeStatus }) {
  const cfg = MAP[status];
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: '0.54rem', fontWeight: 700, letterSpacing: '0.06em',
        padding: '2px 9px', borderRadius: 999,
        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.pulse ? (
        <motion.span
          style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 }}
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' } as Transition}
        />
      ) : (
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color, display: 'inline-block', flexShrink: 0 }} />
      )}
      {cfg.label}
    </span>
  );
}
