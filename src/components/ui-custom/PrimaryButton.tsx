import type { ReactNode, CSSProperties } from 'react';
import { Loader2 } from 'lucide-react';

interface PrimaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  style?: CSSProperties;
  className?: string;
}

export function PrimaryButton({
  children, onClick, disabled = false, loading = false,
  size = 'md', type = 'button', style, className = '',
}: PrimaryButtonProps) {
  const sizeStyles: Record<string, CSSProperties> = {
    sm: { padding: '7px 14px', fontSize: '0.78rem' },
    md: { padding: '10px 20px', fontSize: '0.84rem' },
    lg: { padding: '14px 28px', fontSize: '0.92rem' },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`btn-primary ${className}`}
      style={{ width: className.includes('full') ? '100%' : undefined, ...sizeStyles[size], ...style }}
    >
      {loading && <Loader2 size={14} className="spin" />}
      {children}
    </button>
  );
}
