import { useState, useEffect } from 'react';
import { Calendar, RefreshCw, Plus } from 'lucide-react';
import { CalendarWidget } from '../components/CalendarWidget';

type CalEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  color?: string;
  description?: string;
  htmlLink?: string;
};

function useGoogleCalendarEvents() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const N8N_URL = (import.meta.env.VITE_N8N_CALENDAR_WEBHOOK as string | undefined) ?? '';

  const load = async () => {
    if (!N8N_URL) {
      setError('Configura VITE_N8N_CALENDAR_WEBHOOK en .env.local');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(N8N_URL);
      const data: unknown = await res.json();
      setEvents(Array.isArray(data) ? (data as CalEvent[]) : ((data as { events?: CalEvent[] }).events ?? []));
      setError(null);
      setLastFetch(new Date());
    } catch {
      setError('No se pudieron cargar los eventos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  return { events, loading, error, refetch: load, lastFetch };
}

export function CalendarPage() {
  const { events, loading, error, refetch, lastFetch } = useGoogleCalendarEvents();
  const [viewMode, setViewMode] = useState<'upcoming' | 'all'>('upcoming');
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
            Eventos sincronizados desde Google Calendar
            {lastFetch && ` · Actualizado ${lastFetch.toLocaleTimeString('es-CO')}`}
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => void refetch()} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Actualizar
          </button>
          <a href="https://calendar.google.com/calendar/r/eventedit"
            target="_blank" rel="noreferrer" className="btn-primary">
            <Plus size={14} /> Nuevo evento
          </a>
        </div>
      </div>

      {error && <div className="card section-block"><p className="empty-note">{error}</p></div>}

      <div className="filter-row">
        <button className={`filter-chip ${viewMode==='upcoming'?'active':''}`} onClick={()=>setViewMode('upcoming')}>
          Próximos ({events.filter(e=>new Date(e.start)>=today).length})
        </button>
        <button className={`filter-chip ${viewMode==='all'?'active':''}`} onClick={()=>setViewMode('all')}>
          Todos ({events.length})
        </button>
      </div>

      <div className="card section-block">
        <div className="section-heading">
          <h2>Eventos</h2>
          <span className="badge-count">{displayEvents.length}</span>
        </div>
        {loading ? (
          <p className="empty-note">Cargando...</p>
        ) : displayEvents.length === 0 ? (
          <div className="empty-state">
            <Calendar size={32} />
            <h3>Sin eventos</h3>
            <p>No hay eventos para mostrar.</p>
          </div>
        ) : (
          <div className="cal-event-list">
            {[...displayEvents]
              .sort((a,b)=>new Date(a.start).getTime()-new Date(b.start).getTime())
              .map(event => (
              <div key={event.id} className="cal-event-row-full">
                <div className="cal-event-dot" style={{ background: event.color ?? '#57efff' }} />
                <div className="cal-event-body">
                  <span className="cal-event-title">{event.title}</span>
                  {event.description && <span className="cal-event-date">{event.description}</span>}
                  <span className="cal-event-date">
                    {new Date(event.start).toLocaleDateString('es-CO', {
                      weekday:'long', day:'numeric', month:'long',
                      hour:'2-digit', minute:'2-digit'
                    })}
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
    </div>
  );
}
