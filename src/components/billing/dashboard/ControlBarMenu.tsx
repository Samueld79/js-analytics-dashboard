import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';

interface Props {
  includeInactive: boolean;
  onToggleIncludeInactive: () => void;
  onGenerateInvoices: () => void;
  onAddExtraIncome: () => void;
}

// Menú "⋯" propio (sin <select> nativo para el filtro de estado, sin
// window.confirm) — dropdown simple que se cierra al hacer click afuera.
export function ControlBarMenu({ includeInactive, onToggleIncludeInactive, onGenerateInvoices, onAddExtraIncome }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn-secondary"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Más opciones"
        style={{ padding: '6px 10px' }}
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div
          role="menu"
          className="card-glass"
          style={{
            position: 'absolute',
            top: '110%',
            right: 0,
            zIndex: 30,
            minWidth: 240,
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <button
            role="menuitem"
            className="btn-ghost"
            style={{ textAlign: 'left', justifyContent: 'flex-start', width: '100%' }}
            onClick={() => {
              onGenerateInvoices();
              setOpen(false);
            }}
          >
            Generar cuentas de cobro del mes
          </button>
          <Link
            role="menuitem"
            to="/admin/emisores"
            className="btn-ghost"
            style={{ textAlign: 'left', justifyContent: 'flex-start', width: '100%', textDecoration: 'none' }}
            onClick={() => setOpen(false)}
          >
            Datos de emisores
          </Link>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              fontSize: '0.76rem',
              color: 'var(--fg)',
              cursor: 'pointer',
            }}
          >
            <input type="checkbox" checked={includeInactive} onChange={onToggleIncludeInactive} />
            Incluir clientes inactivos
          </label>
          <button
            role="menuitem"
            className="btn-ghost"
            style={{ textAlign: 'left', justifyContent: 'flex-start', width: '100%' }}
            onClick={() => {
              onAddExtraIncome();
              setOpen(false);
            }}
          >
            Agregar ingreso extra
          </button>
        </div>
      )}
    </div>
  );
}
