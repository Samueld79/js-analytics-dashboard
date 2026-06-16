import { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import type { Ad } from './types';
import { AD_FORMATOS, AD_ANGULOS, TIPO_PLANTILLA_OPTIONS } from './types';

const S: Record<string, React.CSSProperties> = {
  label: { fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  toggle: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
    cursor: 'pointer', userSelect: 'none',
  },
  toggleLabel: { fontSize: '0.8rem', color: 'var(--color-text-secondary)' },
};

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div style={S.toggle} onClick={() => onChange(!value)}>
      <div style={{
        width: 36, height: 20, borderRadius: 20, position: 'relative',
        background: value ? 'var(--color-accent-cyan)' : 'var(--color-bg-secondary)',
        border: `1px solid ${value ? 'var(--color-accent-cyan)' : 'var(--color-border)'}`,
        transition: 'background 0.2s',
        flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: 2, left: value ? 16 : 2, width: 14, height: 14,
          borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s',
        }} />
      </div>
      <span style={S.toggleLabel}>{label}</span>
    </div>
  );
}

type Props = {
  ad: Ad;
  index: number;
  onChange: (field: keyof Ad, value: Ad[keyof Ad]) => void;
  onRemove: () => void;
  canRemove: boolean;
};

export function AdForm({ ad, index, onChange, onRemove, canRemove }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{
      border: '1px solid var(--color-border)',
      borderRadius: 10,
      overflow: 'hidden',
      marginTop: 10,
    }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 14px', background: 'var(--color-bg-secondary)',
          cursor: 'pointer',
        }}
        onClick={() => setOpen((p) => !p)}
      >
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          🎨 Anuncio {index + 1}
          {ad.angulo && (
            <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 8 }}>
              · {ad.angulo.split(' — ')[0]}
            </span>
          )}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {canRemove && (
            <button
              className="btn-ghost"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              style={{ padding: '2px 6px', color: '#ef4444' }}
            >
              <Trash2 size={13} />
            </button>
          )}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {open && (
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Tipo */}
          <div>
            <label style={S.label}>Tipo de anuncio</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['nuevo', 'existente'] as const).map((v) => (
                <label key={v} style={{
                  display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  fontSize: '0.82rem', color: 'var(--color-text-secondary)',
                }}>
                  <input type="radio" checked={ad.tipo === v} onChange={() => onChange('tipo', v)} />
                  {v === 'nuevo' ? 'Crear anuncio nuevo' : 'Usar publicación existente'}
                </label>
              ))}
            </div>
          </div>

          {/* URL */}
          <div>
            <label style={S.label}>URL del post o video</label>
            <input
              className="form-input"
              type="text"
              placeholder="Enlace del post de Facebook/Instagram, o URL del video"
              value={ad.url}
              onChange={(e) => onChange('url', e.target.value)}
            />
            <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
              Si es anuncio nuevo, deja este campo vacío
            </p>
          </div>

          <div style={S.row}>
            {/* Formato */}
            {ad.tipo === 'nuevo' && (
              <div>
                <label style={S.label}>Formato del creativo</label>
                <select className="form-select" value={ad.formato} onChange={(e) => onChange('formato', e.target.value)}>
                  {AD_FORMATOS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )}

            {/* Ángulo */}
            <div style={ad.tipo !== 'nuevo' ? { gridColumn: '1 / -1' } : {}}>
              <label style={S.label}>Ángulo de venta</label>
              <select className="form-select" value={ad.angulo} onChange={(e) => onChange('angulo', e.target.value)}>
                {AD_ANGULOS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Copy */}
          <div>
            <label style={S.label}>Copy del anuncio <span style={{ color: '#ef4444' }}>*</span></label>
            <textarea
              className="form-textarea"
              rows={4}
              placeholder="Pega aquí el copy completo del anuncio (texto principal + CTA)"
              value={ad.copy}
              onChange={(e) => onChange('copy', e.target.value)}
            />
          </div>

          {/* Multi-anunciante */}
          <Toggle
            value={ad.multiAnunciante}
            onChange={(v) => onChange('multiAnunciante', v)}
            label="Activar anuncio multi-anunciante"
          />

          {/* Conversaciones */}
          <div style={{
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: 12,
            display: 'flex', flexDirection: 'column', gap: 10,
            background: 'var(--color-bg-secondary)',
          }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--color-accent-cyan)', margin: 0, textTransform: 'uppercase' }}>
              Configuración de conversaciones
            </p>
            <div>
              <label style={S.label}>Tipo de plantilla</label>
              <select
                className="form-select"
                value={ad.tipoPlantilla}
                onChange={(e) => onChange('tipoPlantilla', e.target.value)}
              >
                {TIPO_PLANTILLA_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            {ad.tipoPlantilla === 'Plantilla guardada (especificar nombre)' && (
              <div>
                <label style={S.label}>Nombre de la plantilla guardada</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Nombre exacto de la plantilla"
                  value={ad.plantillaNombre}
                  onChange={(e) => onChange('plantillaNombre', e.target.value)}
                />
              </div>
            )}
            <div>
              <label style={S.label}>Mensaje de saludo</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="¡Hola! 👋 Gracias por escribirnos. ¿En qué te podemos ayudar?"
                value={ad.saludo}
                onChange={(e) => onChange('saludo', e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(['pregunta1', 'pregunta2', 'pregunta3'] as const).map((k, pi) => (
                <div key={k}>
                  <label style={S.label}>Pregunta frecuente {pi + 1}</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder={`Pregunta ${pi + 1}...`}
                    value={ad[k]}
                    onChange={(e) => onChange(k, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
