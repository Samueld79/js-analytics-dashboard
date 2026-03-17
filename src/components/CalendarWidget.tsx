import { Calendar, ExternalLink, Plus } from 'lucide-react';

type CalEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  color?: string;
  description?: string;
  htmlLink?: string;
};

type Props = {
  events?: CalEvent[];
  loading?: boolean;
  compact?: boolean;
  onAddEvent?: () => void;
};

export function CalendarWidget({ events = [], loading = false, compact = false, onAddEvent }: Props) {
  const today = new Date();
  const upcomingEvents = events
    .filter(e => new Date(e.start) >= today)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, compact ? 4 : 8);

  if (loading) {
    return (
      <div className="card section-block">
        <div className="section-heading">
          <h2><Calendar size={16} style={{ display:'inline', marginRight:6 }} />Calendario</h2>
        </div>
        <p className="empty-note">Cargando eventos...</p>
      </div>
    );
  }

  return (
    <div className="card section-block">
      <div className="section-heading">
        <h2><Calendar size={16} style={{ display:'inline', marginRight:6 }} />Calendario</h2>
        {onAddEvent && (
          <button className="btn-secondary" onClick={onAddEvent} style={{ padding:'4px 10px', fontSize:'0.78rem' }}>
            <Plus size={13} /> Agregar
          </button>
        )}
      </div>
      {upcomingEvents.length === 0 ? (
        <p className="empty-note">No hay eventos próximos.</p>
      ) : (
        <div className="cal-event-list">
          {upcomingEvents.map(event => (
            <div key={event.id} className="cal-event-row">
              <div className="cal-event-dot" style={{ background: event.color ?? '#57efff' }} />
              <div className="cal-event-body">
                <span className="cal-event-title">{event.title}</span>
                <span className="cal-event-date">
                  {new Date(event.start).toLocaleDateString('es-CO', {
                    weekday:'short', day:'numeric', month:'short',
                    hour:'2-digit', minute:'2-digit'
                  })}
                </span>
              </div>
              {event.htmlLink && (
                <a href={event.htmlLink} target="_blank" rel="noreferrer" className="cal-event-link">
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
