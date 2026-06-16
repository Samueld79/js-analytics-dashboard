import { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2, Plus } from 'lucide-react';
import type { AdSet, Campaign, Ad } from './types';
import {
  PERFORMANCE_OPTIONS,
  UBICACION_OPTIONS,
  TIPO_INTERACCION_OPTIONS,
  ENGAGEMENT_PUBLICOS,
  TRAFFIC_PUBLICOS,
  createEmptyAd,
} from './types';
import { AdForm } from './AdForm';

const S: Record<string, React.CSSProperties> = {
  label: {
    fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)',
    marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  sectionTitle: {
    fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
    color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: '4px 0 10px',
  },
  hint: { fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 4 },
};

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', padding: '6px 0' }}
      onClick={() => onChange(!value)}
    >
      <div style={{
        width: 36, height: 20, borderRadius: 20, position: 'relative', flexShrink: 0,
        background: value ? 'var(--color-accent-cyan)' : 'var(--color-bg-secondary)',
        border: `1px solid ${value ? 'var(--color-accent-cyan)' : 'var(--color-border)'}`,
        transition: 'background 0.2s',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: value ? 16 : 2, width: 14, height: 14,
          borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
        }} />
      </div>
      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{label}</span>
    </div>
  );
}

function CheckItem({ checked, label, onChange }: { checked: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer',
      fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.4,
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2, flexShrink: 0 }}
      />
      {label}
    </label>
  );
}

type Props = {
  adset: AdSet;
  index: number;
  campaignObjective: Campaign['objetivo'];
  budgetType: Campaign['tipoPresupuesto'];
  onChange: <K extends keyof AdSet>(field: K, value: AdSet[K]) => void;
  onRemove: () => void;
  canRemove: boolean;
};

export function AdSetForm({ adset, index, campaignObjective, budgetType, onChange, onRemove, canRemove }: Props) {
  const [open, setOpen] = useState(true);
  const [audienciaOpen, setAudienciaOpen] = useState(true);

  const ubicaciones = UBICACION_OPTIONS[campaignObjective];
  const hasUbicacion = ubicaciones.length > 0;
  const showTipoInteraccion = campaignObjective === 'Interacción' && adset.ubicacionConversion === 'En tu anuncio';
  const performanceOpts = PERFORMANCE_OPTIONS[campaignObjective];

  function updateAd(adId: string, field: keyof Ad, value: Ad[keyof Ad]) {
    onChange('anuncios', adset.anuncios.map((a) => a.id === adId ? { ...a, [field]: value } : a));
  }

  function addAd() {
    onChange('anuncios', [...adset.anuncios, createEmptyAd()]);
  }

  function removeAd(adId: string) {
    onChange('anuncios', adset.anuncios.filter((a) => a.id !== adId));
  }

  function togglePublico(label: string, checked: boolean) {
    const next = checked
      ? [...adset.incluirPublicos, label]
      : adset.incluirPublicos.filter((p) => p !== label);
    onChange('incluirPublicos', next);
  }

  function togglePlataforma(key: keyof typeof adset.plataformas, checked: boolean) {
    onChange('plataformas', { ...adset.plataformas, [key]: checked });
  }

  return (
    <div style={{
      border: `1px solid var(--color-border)`,
      borderRadius: 12,
      overflow: 'hidden',
      marginTop: 12,
    }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 16px',
          background: 'color-mix(in srgb, var(--color-accent-cyan) 8%, var(--color-bg-secondary))',
          cursor: 'pointer',
        }}
        onClick={() => setOpen((p) => !p)}
      >
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          📦 Conjunto {index + 1}
          {adset.nombre && (
            <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 8, fontSize: '0.76rem' }}>
              · {adset.nombre}
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
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Nombre */}
          <div>
            <label style={S.label}>Nombre del conjunto <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              className="form-input"
              type="text"
              placeholder="Ej: TOFU_Medellin_Mujeres25-45"
              value={adset.nombre}
              onChange={(e) => onChange('nombre', e.target.value)}
            />
          </div>

          {/* Ubicación (dynamic) */}
          {hasUbicacion && (
            <div>
              <label style={S.label}>Ubicación de conversión</label>
              <select
                className="form-select"
                value={adset.ubicacionConversion}
                onChange={(e) => {
                  onChange('ubicacionConversion', e.target.value);
                  onChange('tipoInteraccion', '');
                }}
              >
                <option value="">Seleccionar...</option>
                {ubicaciones.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}

          {/* Tipo de interacción (solo Interacción + "En tu anuncio") */}
          {showTipoInteraccion && (
            <div>
              <label style={S.label}>Tipo de interacción</label>
              <select
                className="form-select"
                value={adset.tipoInteraccion}
                onChange={(e) => onChange('tipoInteraccion', e.target.value)}
              >
                <option value="">Seleccionar...</option>
                {TIPO_INTERACCION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}

          {/* Objetivo de rendimiento */}
          <div>
            <label style={S.label}>Objetivo de rendimiento</label>
            <select
              className="form-select"
              value={adset.objetivoRendimiento}
              onChange={(e) => onChange('objetivoRendimiento', e.target.value)}
            >
              <option value="">Seleccionar...</option>
              {performanceOpts.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Presupuesto conjunto (ABO only) */}
          {budgetType === 'ABO' && (
            <div>
              <label style={S.label}>Presupuesto del conjunto (COP/día)</label>
              <input
                className="form-input"
                type="number"
                min={0}
                placeholder="Ej: 15000"
                value={adset.presupuesto || ''}
                onChange={(e) => onChange('presupuesto', Number(e.target.value))}
              />
            </div>
          )}

          {/* ─── Audiencia ─── */}
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 14px', background: 'var(--color-bg-secondary)', cursor: 'pointer',
              }}
              onClick={() => setAudienciaOpen((p) => !p)}
            >
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                👥 Controles de audiencia
              </span>
              {audienciaOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>

            {audienciaOpen && (
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Lugares */}
                <div>
                  <label style={S.label}>Lugares</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="Ej: Colombia — Medellín, Bogotá, Cali"
                    value={adset.lugares}
                    onChange={(e) => onChange('lugares', e.target.value)}
                  />
                  <p style={S.hint}>Especifica país + ciudades si aplica</p>
                </div>

                {/* Advantage+ Audience */}
                <Toggle
                  value={adset.advantagePlus}
                  onChange={(v) => onChange('advantagePlus', v)}
                  label="Advantage+ Audience — permitir alcance fuera de los controles"
                />

                {/* Edad + Género */}
                <div style={S.row2}>
                  <div>
                    <label style={S.label}>Edad mínima</label>
                    <input
                      className="form-input"
                      type="number"
                      min={13}
                      max={65}
                      value={adset.edadMin}
                      onChange={(e) => onChange('edadMin', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label style={S.label}>Edad máxima</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {!adset.edadMaxPlus && (
                        <input
                          className="form-input"
                          type="number"
                          min={13}
                          max={65}
                          value={adset.edadMax}
                          onChange={(e) => onChange('edadMax', Number(e.target.value))}
                          style={{ flex: 1 }}
                        />
                      )}
                      <label style={{
                        display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                        fontSize: '0.78rem', color: 'var(--color-text-secondary)', cursor: 'pointer',
                      }}>
                        <input
                          type="checkbox"
                          checked={adset.edadMaxPlus}
                          onChange={(e) => onChange('edadMaxPlus', e.target.checked)}
                        />
                        65+
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label style={S.label}>Género</label>
                  <select
                    className="form-select"
                    value={adset.genero}
                    onChange={(e) => onChange('genero', e.target.value)}
                  >
                    {['Todos', 'Solo hombres', 'Solo mujeres'].map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                {/* Públicos a incluir */}
                <div>
                  <p style={S.sectionTitle}>Públicos personalizados a incluir</p>
                  <p style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', margin: '0 0 6px' }}>
                    Interacción con contenido
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {ENGAGEMENT_PUBLICOS.map((lbl) => (
                      <CheckItem
                        key={lbl}
                        label={lbl}
                        checked={adset.incluirPublicos.includes(lbl)}
                        onChange={(v) => togglePublico(lbl, v)}
                      />
                    ))}
                  </div>
                  <p style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', margin: '0 0 6px' }}>
                    Tráfico y clientes
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {TRAFFIC_PUBLICOS.map((lbl) => (
                      <CheckItem
                        key={lbl}
                        label={lbl}
                        checked={adset.incluirPublicos.includes(lbl)}
                        onChange={(v) => togglePublico(lbl, v)}
                      />
                    ))}
                  </div>
                  <div>
                    <label style={S.label}>Otros públicos personalizados</label>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="Ej: Remarketing mensajes sin respuesta"
                      value={adset.otrosPublicos}
                      onChange={(e) => onChange('otrosPublicos', e.target.value)}
                    />
                  </div>
                </div>

                {/* Excluir */}
                <div>
                  <label style={S.label}>Excluir públicos personalizados</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="Ej: Compradores últimos 30 días, Lista de clientes actuales"
                    value={adset.excluirPublicos}
                    onChange={(e) => onChange('excluirPublicos', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ─── Plataformas ─── */}
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '12px 14px' }}>
            <p style={S.sectionTitle}>📱 Ubicaciones / Plataformas</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(
                [
                  { key: 'facebook', label: 'Facebook (Feed, Reels, Stories)' },
                  { key: 'instagram', label: 'Instagram (Feed, Reels, Stories)' },
                  { key: 'messenger', label: 'Messenger' },
                  { key: 'audienceNetwork', label: 'Audience Network' },
                  { key: 'threads', label: 'Threads' },
                ] as const
              ).map(({ key, label }) => (
                <CheckItem
                  key={key}
                  label={label + (key === 'audienceNetwork' ? ' (excluida por defecto)' : '')}
                  checked={adset.plataformas[key]}
                  onChange={(v) => togglePlataforma(key, v)}
                />
              ))}
            </div>
          </div>

          {/* ─── Anuncios ─── */}
          <div>
            <p style={S.sectionTitle}>Anuncios en este conjunto</p>
            {adset.anuncios.map((ad, ai) => (
              <AdForm
                key={ad.id}
                ad={ad}
                index={ai}
                onChange={(f, v) => updateAd(ad.id, f, v)}
                onRemove={() => removeAd(ad.id)}
                canRemove={adset.anuncios.length > 1}
              />
            ))}
            <button
              className="btn-ghost"
              onClick={addAd}
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: '0.78rem' }}
            >
              <Plus size={14} /> Agregar anuncio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
