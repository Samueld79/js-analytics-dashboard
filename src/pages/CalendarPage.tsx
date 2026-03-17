import { useState, useEffect } from 'react';
import { Calendar, RefreshCw, Plus, X, Clock, AlignLeft } from 'lucide-react';

type CalEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  color?: string;
  description?: string;
  htmlLink?: string;
};

type NewEventForm = {
  title: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  description: string;
};

function useGoogleCalendarEvents() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const READ_URL = (import.meta.env.VITE_N8N_CALENDAR_WEBHOOK as string | undefined) ?? '';
  const WRITE_URL = (import.meta.env.VITE_N8N_CALENDAR_CREATE as string | undefined) ?? '';

  const load = async () => {
    if (!READ_URL) {
      setError('Configura VITE_N8N_CALENDAR_WEBHOOK en .env.local');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(READ_URL);
      const data: unknown = await res.json();
      setEvents(
        Array.isArray(data)
          ? (data as CalEvent[])
          : ((data as { events?: CalEvent[] }).events ?? [])
      );
      setError(null);
      setLastFetch(new Date());
    } catch {
      setError('No se pudieron cargar los eventos.');
    } finally {
      setLoading(false);
    }
  };

  const createEvent = async (form: NewEventForm): Promise<boolean> => {
    if (!WRITE_URL) {
      alert('Configura VITE_N8N_CALENDAR_CREATE en .env.local');
      return false;
    }
    try {
      const res = await fetch(WRITE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          start: `${form.date}T${form.timeStart}:00`,
          end: `${form.date}T${form.timeEnd}:00`,
          description: form.description,
        }),
      });
      if (!res.ok) throw new Error('Error al crear evento');
      await load();
      return true;
    } catch {
      alert('No se pudo crear el evento. Verifica la conexión con n8n.');
      return false;
    }
  };

  useEffect(() => { void load(); }, []);
  return { events, loading, error, refetch: load, lastFetch, createEvent };
}

function NewEventModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (form: NewEventForm) => Promise<void>;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<NewEventForm>({
    title: '',
    date: today,
    timeStart: '09:00',
    timeEnd: '10:00',
    description: '',
  });
  const setField = (field: keyof NewEventForm, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.title.trim()) { alert('El título es obligatorio.'); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Nuevo evento</h2>
            <p className="modal-subtitle">Se guardará en tu Google Calendar</p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-field required">
            <label>Título</label>
            <input className="form-input" value={form.title}
              onChange={e => setField('title', e.target.value)}
              placeholder="Ej. Reunión con Libell Joyería" autoFocus />
          </div>
          <div className="form-field required">
            <label>Fecha</label>
            <input className="form-input" type="date" value={form.date}
              onChange={e => setField('date', e.target.value)} />
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label><Clock size={13} style={{ display:'inline', marginRight:4 }} />Inicio</label>
              <input className="form-input" type="time" value={form.timeStart}
                onChange={e => setField('timeStart', e.target.value)} />
            </div>
            <div className="form-field">
              <label><Clock size={13} style={{ display:'inline', marginRight:4 }} />Fin</label>
              <input className="form-input" type="time" value={form.timeEnd}
                onChange={e => setField('timeEnd', e.target.value)} />
            </div>
          </div>
          <div className="form-field">
            <label><AlignLeft size={13} style={{ display:'inline', marginRight:4 }} />Descripción</label>
            <textarea className="form-textarea" rows={3} value={form.description}
              onChange={e => setField('description', e.target.value)}
              placeholder="Notas del evento..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Creando...' : 'Crear evento'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CalendarPage() {
  const { events, loading, error, refetch, lastFetch, createEvent } = useGoogleCalendarEvents();
  const [viewMode, setViewMode] = useState<'upcoming' | 'all'>('upcoming');
  const [showModal, setShowModal] = useState(false);
  const today = new Date();
  const displayEvents = viewMode === 'upcoming'
    ? events.filter(e => new Date(e.start) >= today)
    : events;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Calendar size={20} style={{ display:'inline', marginRight:8, verticalAlign:'middle' }} />
            Calendario
          </h1>
          <p className="page-subtitle">
            Sincronizado con Google Calendar
            {lastFetch && ` · ${lastFetch.toLocaleTimeString('es-CO')}`}
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => void refetch()} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Actualizar
          </button>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={14} /> Nuevo evento
          </button>
        </div>
      </div>

      {error && <div className="card section-block"><p className="empty-note">{error}</p></div>}

      <div className="filter-row">
        <button className={`filter-chip ${viewMode==='upcoming'?'active':''}`}
          onClick={() => setViewMode('upcoming')}>
          Próximos ({events.filter(e => new Date(e.start) >= today).length})
        </button>
        <button className={`filter-chip ${viewMode==='all'?'active':''}`}
          onClick={() => setViewMode('all')}>
          Todos ({events.length})
        </button>
      </div>

      <div className="card section-block">
        <div className="section-heading">
          <h2>Eventos</h2>
          <span className="badge-count">{displayEvents.length}</span>
        </div>
        {loading ? (
          <p className="empty-note">Cargando eventos...</p>
        ) : displayEvents.length === 0 ? (
          <div className="empty-state">
            <Calendar size={32} />
            <h3>Sin eventos</h3>
            <p>Crea uno con el botón "Nuevo evento".</p>
          </div>
        ) : (
          <div className="cal-event-list">
            {[...displayEvents]
              .sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime())
              .map(event => (
              <div key={event.id} className="cal-event-row-full">
                <div className="cal-event-dot" style={{ background: event.color ?? '#57efff' }} />
                <div className="cal-event-body">
                  <span className="cal-event-title">{event.title}</span>
                  {event.description && (
                    <span className="cal-event-date">{event.description}</span>
                  )}
                  <span className="cal-event-date">
                    {new Date(event.start).toLocaleDateString('es-CO', {
                      weekday:'long', day:'numeric', month:'long',
                      hour:'2-digit', minute:'2-digit'
                    })}
                    {event.end && ` → ${new Date(event.end).toLocaleTimeString('es-CO', {
                      hour:'2-digit', minute:'2-digit'
                    })}`}
                  </span>
                </div>
                {event.htmlLink && (
                  <a href={event.htmlLink} target="_blank" rel="noreferrer"
                    className="btn-ghost" style={{ padding:'4px 10px', fontSize:'0.76rem' }}>
                    Abrir
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <NewEventModal
          onClose={() => setShowModal(false)}
          onSave={async form => {
            const ok = await createEvent(form);
            if (ok) setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
