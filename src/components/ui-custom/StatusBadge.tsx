interface StatusBadgeProps {
  status: 'success' | 'warning' | 'danger' | 'muted';
  label: string;
}

const CONFIG = {
  success: { className: 'badge badge-success', dotColor: 'var(--success)', pulse: false },
  warning: { className: 'badge badge-warning', dotColor: 'var(--warning)', pulse: false },
  danger:  { className: 'badge badge-danger',  dotColor: 'var(--danger)',  pulse: true  },
  muted:   { className: 'badge badge-muted',   dotColor: 'var(--fg-muted)', pulse: false },
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const cfg = CONFIG[status];
  return (
    <span className={cfg.className}>
      <span
        style={{
          width: 5, height: 5, borderRadius: '50%',
          background: cfg.dotColor, flexShrink: 0,
          animation: cfg.pulse ? 'pulse-dot 1.5s ease-in-out infinite' : 'none',
          display: 'inline-block',
        }}
      />
      {label}
    </span>
  );
}
