import { formatCopExact } from '../../../lib/utils';

function netPhrase(net: number): string {
  if (net > 0) return `Samuel le paga a Juanca ${formatCopExact(net)}`;
  if (net < 0) return `Juanca le paga a Samuel ${formatCopExact(Math.abs(net))}`;
  return 'Están a mano';
}

interface Props {
  net: number;
  sharedPendingCount: number;
  settling: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

// Modal propio (sin window.confirm) para "Liquidar saldo". Si todavía hay
// cobros compartidos sin pagar en el mes seleccionado, exige un segundo
// botón explícito en vez de la confirmación normal.
export function SettleConfirmModal({ net, sharedPendingCount, settling, onConfirm, onClose }: Props) {
  const hasPending = sharedPendingCount > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Liquidar saldo</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--fg)' }}>{netPhrase(net)}</p>

          {hasPending ? (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 'var(--r-sm)',
                background: 'var(--warning-dim)',
                border: '1px solid var(--warning)',
              }}
            >
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--warning)' }}>
                Aún faltan {sharedPendingCount} cobro{sharedPendingCount === 1 ? '' : 's'} compartido
                {sharedPendingCount === 1 ? '' : 's'} por pagar. Si liquidas ahora, el saldo se calculará solo con lo
                ya cobrado.
              </p>
            </div>
          ) : (
            <p style={{ marginTop: 10, fontSize: '0.74rem', color: 'var(--fg-muted)' }}>
              Esto registra la liquidación y marca los cobros compartidos pagados y sin repartir como liquidados.
            </p>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose} disabled={settling}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={onConfirm} disabled={settling}>
            {settling ? 'Liquidando...' : hasPending ? 'Liquidar de todos modos' : 'Confirmar liquidación'}
          </button>
        </div>
      </div>
    </div>
  );
}
