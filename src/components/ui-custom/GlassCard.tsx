import type { ReactNode, CSSProperties } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  style?: CSSProperties;
}

export function GlassCard({ children, className = '', onClick, hoverable = false, style }: GlassCardProps) {
  const classes = ['glass', hoverable ? 'glass-hoverable' : '', 'animate-fade-up', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      style={style}
    >
      {children}
    </div>
  );
}
