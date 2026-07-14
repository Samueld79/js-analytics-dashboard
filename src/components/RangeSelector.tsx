import { ChevronDown } from 'lucide-react';

export const RANGE_OPTIONS = [
  { days: 200, label: '6 meses' },
  { days: 365, label: 'Año completo' },
  { days: 730, label: 'Todo el historial' },
] as const;

type RangeSelectorProps = {
  days: number;
  onChange: (days: number) => void;
  className?: string;
};

export function RangeSelector({ days, onChange, className = 'dash-period-select' }: RangeSelectorProps) {
  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      title="Rango de datos cargados (solo vista de todos los clientes)"
    >
      <select className={className} value={days} onChange={(e) => onChange(Number(e.target.value))}>
        {RANGE_OPTIONS.map((opt) => (
          <option key={opt.days} value={opt.days}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown size={12} style={{ position: 'absolute', right: 10, pointerEvents: 'none', color: 'var(--color-text-muted)' }} />
    </div>
  );
}
