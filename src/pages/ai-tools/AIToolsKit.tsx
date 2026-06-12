import { useCallback, useEffect, useState } from 'react';
import { Save, Pencil, AlertCircle, CheckCircle } from 'lucide-react';
import { useAITools } from '../../hooks/useAIToolsContext';
import { upsertBrandKit, type BrandKit } from '../../services/aiToolsService';

type FormState = Omit<BrandKit, 'id' | 'client_id' | 'created_at' | 'updated_at'>;

const EMPTY_FORM: FormState = {
  name: '',
  colors: '',
  fonts: '',
  voice: '',
  audiences: '',
  differentiators: '',
  do_not: '',
};

function KitField({
  label,
  hint,
  value,
  onChange,
  multiline,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="form-field">
      <label className="form-label">{label}</label>
      <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '0 0 6px' }}>{hint}</p>
      {multiline ? (
        <textarea
          className="form-textarea"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="form-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

export function AIToolsKit() {
  const { selectedClientId, clients, kit, kitLoading, reloadKit } = useAITools();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const client = clients.find((c) => c.id === selectedClientId);

  useEffect(() => {
    if (kit) {
      setForm({
        name: kit.name,
        colors: kit.colors,
        fonts: kit.fonts,
        voice: kit.voice,
        audiences: kit.audiences,
        differentiators: kit.differentiators,
        do_not: kit.do_not,
      });
      setEditing(false);
    } else if (!kitLoading && selectedClientId) {
      setForm({ ...EMPTY_FORM, name: client?.name ?? '' });
      setEditing(true);
    }
  }, [kit, kitLoading, selectedClientId, client]);

  const handleSave = useCallback(async () => {
    if (!selectedClientId) return;
    if (!form.name.trim()) { setSaveError('El nombre de marca es requerido'); return; }

    setSaving(true);
    setSaveError(null);
    setSaveOk(false);

    const { error } = await upsertBrandKit({ ...form, client_id: selectedClientId });
    if (error) {
      setSaveError(error);
    } else {
      setSaveOk(true);
      setEditing(false);
      await reloadKit();
      setTimeout(() => setSaveOk(false), 3000);
    }
    setSaving(false);
  }, [selectedClientId, form, reloadKit]);

  if (!selectedClientId) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
        Selecciona un cliente en la barra superior para ver su kit de marca.
      </div>
    );
  }

  if (kitLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
        Cargando kit...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
            Kit de Marca
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            {client?.name ?? '—'} · Los datos del kit se incluyen en todos los prompts de IA
          </p>
        </div>
        {kit && !editing && (
          <button
            className="btn-ghost"
            onClick={() => setEditing(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Pencil size={14} /> Editar
          </button>
        )}
      </div>

      {/* Form */}
      <div style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 14,
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}>
        <KitField
          label="Nombre de marca"
          hint="Nombre oficial o comercial de la marca"
          value={form.name}
          onChange={(v) => setForm((p) => ({ ...p, name: v }))}
        />
        <KitField
          label="Colores de marca"
          hint="Colores principales con su código hex o nombre. Ej: Azul oscuro #1a3c6e, Dorado #D4A017"
          value={form.colors}
          onChange={(v) => setForm((p) => ({ ...p, colors: v }))}
        />
        <KitField
          label="Tipografías"
          hint="Fuentes utilizadas en la comunicación. Ej: Montserrat (títulos), Open Sans (cuerpo)"
          value={form.fonts}
          onChange={(v) => setForm((p) => ({ ...p, fonts: v }))}
        />
        <KitField
          label="Voz de marca"
          hint="Cómo habla la marca: tono, personalidad, estilo de comunicación"
          value={form.voice}
          onChange={(v) => setForm((p) => ({ ...p, voice: v }))}
          multiline
        />
        <KitField
          label="Audiencias objetivo"
          hint="Segmentos principales: edad, género, intereses, situación de vida"
          value={form.audiences}
          onChange={(v) => setForm((p) => ({ ...p, audiences: v }))}
          multiline
        />
        <KitField
          label="Diferenciadores clave"
          hint="Qué hace única a esta marca vs la competencia"
          value={form.differentiators}
          onChange={(v) => setForm((p) => ({ ...p, differentiators: v }))}
          multiline
        />
        <KitField
          label="No hacer / Restricciones"
          hint="Temas, palabras, estilos o referencias a evitar"
          value={form.do_not}
          onChange={(v) => setForm((p) => ({ ...p, do_not: v }))}
          multiline
        />

        {saveError && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px',
            background: 'color-mix(in srgb, #ef4444 10%, transparent)',
            border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)',
            borderRadius: 8, color: '#ef4444', fontSize: '0.8rem',
          }}>
            <AlertCircle size={14} /> {saveError}
          </div>
        )}

        {saveOk && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px',
            background: 'color-mix(in srgb, #22c55e 10%, transparent)',
            border: '1px solid color-mix(in srgb, #22c55e 30%, transparent)',
            borderRadius: 8, color: '#22c55e', fontSize: '0.8rem',
          }}>
            <CheckCircle size={14} /> Kit guardado correctamente
          </div>
        )}

        {editing && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn-primary"
              onClick={() => void handleSave()}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Save size={14} />
              {saving ? 'Guardando...' : 'Guardar kit'}
            </button>
            {kit && (
              <button
                className="btn-ghost"
                onClick={() => {
                  setForm({
                    name: kit.name, colors: kit.colors, fonts: kit.fonts,
                    voice: kit.voice, audiences: kit.audiences,
                    differentiators: kit.differentiators, do_not: kit.do_not,
                  });
                  setEditing(false);
                  setSaveError(null);
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
