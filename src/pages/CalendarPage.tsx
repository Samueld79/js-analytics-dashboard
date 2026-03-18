import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, type Transition } from 'framer-motion';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
  addMonths,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, Plus, X, Clock, AlignLeft } from 'lucide-react';

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
      // Normalizar: puede ser objeto, array, o array de objetos con .json
      const normalize = (d: unknown): CalEvent[] => {
        if (!d) return [];
        if (Array.isArray(d)) {
          // n8n a veces devuelve [{json: {...}}, {json: {...}}]
          if ((d as { json?: unknown }[])[0]?.json) return (d as { json: CalEvent }[]).map((item) => item.json);
          return d as CalEvent[];
        }
        // objeto único
        if ((d as { json?: CalEvent }).json) return [(d as { json: CalEvent }).json];
        return [d as CalEvent];
      };
      setEvents(normalize(data));
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

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { events, loading, error, refetch: load, lastFetch, createEvent };
}

function NewEventModal({
  onClose,
  onSave,
  initialDate,
}: {
  onClose: () => void;
  onSave: (form: NewEventForm) => Promise<void>;
  initialDate?: string;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<NewEventForm>({
    title: '',
    date: initialDate ?? today,
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
              placeholder="Ej. Reunión con cliente" autoFocus />
          </div>
          <div className="form-field required">
            <label>Fecha</label>
            <input className="form-input" type="date" value={form.date}
              onChange={e => setField('date', e.target.value)} />
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label><Clock size={13} style={{ display: 'inline', marginRight: 4 }} />Inicio</label>
              <input className="form-input" type="time" value={form.timeStart}
                onChange={e => setField('timeStart', e.target.value)} />
            </div>
            <div className="form-field">
              <label><Clock size={13} style={{ display: 'inline', marginRight: 4 }} />Fin</label>
              <input className="form-input" type="time" value={form.timeEnd}
                onChange={e => setField('timeEnd', e.target.value)} />
            </div>
          </div>
          <div className="form-field">
            <label><AlignLeft size={13} style={{ display: 'inline', marginRight: 4 }} />Descripción</label>
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

const WEEK_LABELS = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];

export function CalendarPage() {
  const { events, loading, error, lastFetch, createEvent } = useGoogleCalendarEvents();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  // Update countdown every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Build calendar grid (Mon–Sun weeks)
  const gridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const eventsOnDay = (day: Date) =>
    events.filter(e => isSameDay(new Date(e.start), day));

  // All events in the currently viewed month, sorted
  const monthEvents = useMemo(() =>
    events
      .filter(e => isSameMonth(new Date(e.start), currentMonth))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    [events, currentMonth],
  );

  // Events for selected day
  const selectedDayEvents = useMemo(() =>
    selectedDay ? events.filter(e => isSameDay(new Date(e.start), selectedDay)) : [],
    [events, selectedDay],
  );

  // Next future event for countdown
  const nextEvent = useMemo(() =>
    events
      .filter(e => new Date(e.start) > now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0] ?? null,
    [events, now],
  );

  const countdown = useMemo(() => {
    if (!nextEvent) return null;
    const diff = new Date(nextEvent.start).getTime() - now.getTime();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  }, [nextEvent, now]);

  const handleDayClick = (day: Date) => {
    if (!isSameMonth(day, currentMonth)) return;
    const dayEvents = eventsOnDay(day);
    if (dayEvents.length > 0) {
      setSelectedDay(prev => (prev && isSameDay(prev, day) ? null : day));
    } else {
      setModalDate(format(day, 'yyyy-MM-dd'));
    }
  };

  const displayEvents = selectedDay && selectedDayEvents.length > 0 ? selectedDayEvents : monthEvents;
  const listLabel = selectedDay && selectedDayEvents.length > 0
    ? format(selectedDay, "d 'de' MMMM", { locale: es })
    : format(currentMonth, 'MMMM yyyy', { locale: es });

  return (
    <div className="page-content">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendario</h1>
          <p className="page-subtitle">
            SINCRONIZADO CON GOOGLE CALENDAR
            {lastFetch && ` · ${lastFetch.toLocaleTimeString('es-CO')}`}
            {loading && ' · Actualizando...'}
          </p>
        </div>
        <button
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={() => setModalDate(format(new Date(), 'yyyy-MM-dd'))}
        >
          <Plus size={14} />
          Nuevo evento
        </button>
      </div>

      {error && (
        <div style={{ padding: '0 24px 16px' }}>
          <p style={{
            fontFamily: 'JetBrains Mono',
            fontSize: '0.72rem',
            color: 'hsl(0,84%,65%)',
            padding: '10px 14px',
            background: 'hsl(0 84% 60% / 0.08)',
            border: '1px solid hsl(0 84% 60% / 0.15)',
            borderRadius: '4px',
          }}>
            {error}
          </p>
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '65% 35%',
        gap: '16px',
        padding: '0 24px 24px',
      }}>

        {/* ── Left: Monthly grid ── */}
        <motion.div
          className="card-glass"
          style={{ padding: '24px', borderRadius: '4px' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' } as Transition}
        >
          {/* Month nav */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
          }}>
            <button
              onClick={() => { setCurrentMonth(m => subMonths(m, 1)); setSelectedDay(null); }}
              style={{
                background: 'none',
                border: '1px solid hsl(0 0% 100% / 0.08)',
                borderRadius: '4px',
                padding: '6px 8px',
                color: 'hsl(215,15%,60%)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ChevronLeft size={16} />
            </button>

            <h2 style={{
              fontFamily: 'Outfit, sans-serif',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'hsl(0,0%,92%)',
              textTransform: 'capitalize',
              letterSpacing: '-0.01em',
              margin: 0,
            }}>
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </h2>

            <button
              onClick={() => { setCurrentMonth(m => addMonths(m, 1)); setSelectedDay(null); }}
              style={{
                background: 'none',
                border: '1px solid hsl(0 0% 100% / 0.08)',
                borderRadius: '4px',
                padding: '6px 8px',
                color: 'hsl(215,15%,60%)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Week day headers */}
          <div className="calendar-grid" style={{ marginBottom: '4px' }}>
            {WEEK_LABELS.map(d => (
              <div
                key={d}
                style={{
                  textAlign: 'center',
                  fontFamily: 'JetBrains Mono',
                  fontSize: '0.6rem',
                  letterSpacing: '0.08em',
                  color: 'hsl(215,15%,45%)',
                  paddingBottom: '8px',
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="calendar-grid">
            {gridDays.map((day, idx) => {
              const weekRow = Math.floor(idx / 7);
              const inMonth = isSameMonth(day, currentMonth);
              const isCurrentDay = isToday(day);
              const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
              const hasEvents = eventsOnDay(day).length > 0;

              const classes = [
                'calendar-day',
                isCurrentDay ? 'today' : '',
                hasEvents ? 'has-event' : '',
                isSelected ? 'selected' : '',
              ].filter(Boolean).join(' ');

              return (
                <motion.div
                  key={day.toISOString()}
                  className={classes}
                  onClick={() => handleDayClick(day)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: inMonth ? 1 : 0.2, y: 0 }}
                  transition={{ delay: weekRow * 0.06, duration: 0.25 } as Transition}
                  style={{ cursor: inMonth ? 'pointer' : 'default' }}
                >
                  {format(day, 'd')}
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Right panel ── */}
        <motion.div
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 } as Transition}
        >
          {/* Section A: Countdown */}
          <div className="card-glass" style={{ padding: '20px', borderRadius: '4px' }}>
            {nextEvent && countdown ? (
              <>
                <span className="number-label" style={{ display: 'block', marginBottom: '12px' }}>
                  PRÓXIMO EVENTO
                </span>
                <h3 style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: 'hsl(0,0%,98%)',
                  letterSpacing: '-0.01em',
                  margin: '0 0 4px',
                  lineHeight: 1.3,
                }}>
                  {nextEvent.title}
                </h3>
                <p className="number-label" style={{ marginBottom: '16px' }}>
                  {format(new Date(nextEvent.start), "d 'de' MMMM · HH:mm", { locale: es })}
                </p>

                {/* Countdown grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '6px',
                  marginBottom: '16px',
                }}>
                  {([
                    { value: countdown.days, label: 'DÍAS' },
                    { value: countdown.hours, label: 'HRS' },
                    { value: countdown.minutes, label: 'MIN' },
                    { value: countdown.seconds, label: 'SEG' },
                  ] as const).map(unit => (
                    <div
                      key={unit.label}
                      style={{
                        background: 'hsl(220,18%,9%)',
                        border: '1px solid hsl(0 0% 100% / 0.06)',
                        borderRadius: '4px',
                        padding: '10px 6px',
                        textAlign: 'center',
                      }}
                    >
                      <AnimatePresence mode="popLayout">
                        <motion.div
                          key={`${unit.label}-${unit.value}`}
                          initial={{ scale: 1.15, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.85, opacity: 0 }}
                          transition={{ duration: 0.15 } as Transition}
                          style={{
                            fontFamily: 'Outfit, sans-serif',
                            fontSize: '1.4rem',
                            fontWeight: 700,
                            color: 'hsl(180,100%,50%)',
                            lineHeight: 1,
                          }}
                        >
                          {String(unit.value).padStart(2, '0')}
                        </motion.div>
                      </AnimatePresence>
                      <div
                        className="number-label"
                        style={{ marginTop: '4px', fontSize: '0.58rem' }}
                      >
                        {unit.label}
                      </div>
                    </div>
                  ))}
                </div>

                {nextEvent.htmlLink && (
                  <a
                    href={nextEvent.htmlLink}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary"
                    style={{
                      display: 'block',
                      textAlign: 'center',
                      fontSize: '0.7rem',
                      padding: '7px',
                      textDecoration: 'none',
                    }}
                  >
                    Ver en Google Calendar ↗
                  </a>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <Calendar
                  size={28}
                  style={{ color: 'hsl(215,15%,35%)', margin: '0 auto 12px', display: 'block' }}
                />
                <p className="number-label" style={{ marginBottom: '12px' }}>
                  SIN EVENTOS PRÓXIMOS
                </p>
                <button
                  className="btn-primary"
                  style={{ fontSize: '0.72rem', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => setModalDate(format(new Date(), 'yyyy-MM-dd'))}
                >
                  <Plus size={12} />
                  Crear primer evento
                </button>
              </div>
            )}
          </div>

          {/* Section B: Event list */}
          <div className="card-glass" style={{ borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid hsl(0 0% 100% / 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span className="number-label" style={{ textTransform: 'capitalize' }}>
                {listLabel}
              </span>
              {selectedDay && (
                <button
                  onClick={() => setSelectedDay(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'hsl(215,15%,45%)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {displayEvents.length === 0 ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                fontFamily: 'JetBrains Mono',
                fontSize: '0.72rem',
                color: 'hsl(215,15%,40%)',
              }}>
                Sin eventos en este período
              </div>
            ) : (
              <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                {displayEvents.map(event => (
                  <div
                    key={event.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px 20px',
                      borderBottom: '1px solid hsl(0 0% 100% / 0.04)',
                      transition: 'background 150ms ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'hsl(0 0% 100% / 0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Day badge */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      minWidth: '28px',
                      flexShrink: 0,
                    }}>
                      <span style={{
                        fontFamily: 'JetBrains Mono',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: 'hsl(180,100%,50%)',
                        lineHeight: 1,
                      }}>
                        {format(new Date(event.start), 'd')}
                      </span>
                      <span className="number-label" style={{ fontSize: '0.55rem', marginTop: '2px', textTransform: 'uppercase' }}>
                        {format(new Date(event.start), 'MMM', { locale: es })}
                      </span>
                    </div>

                    {/* Event info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontFamily: 'Outfit, sans-serif',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: 'hsl(0,0%,92%)',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {event.title}
                      </p>
                      <p className="number-label" style={{ marginTop: '2px', fontSize: '0.62rem' }}>
                        {format(new Date(event.start), 'HH:mm')}
                        {event.end && ` → ${format(new Date(event.end), 'HH:mm')}`}
                      </p>
                      {event.description && (
                        <p style={{
                          fontFamily: 'JetBrains Mono',
                          fontSize: '0.62rem',
                          color: 'hsl(215,15%,45%)',
                          margin: '4px 0 0',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {event.description}
                        </p>
                      )}
                    </div>

                    {event.htmlLink && (
                      <a
                        href={event.htmlLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{
                          color: 'hsl(215,15%,45%)',
                          textDecoration: 'none',
                          fontSize: '0.78rem',
                          flexShrink: 0,
                          transition: 'color 150ms ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'hsl(180,100%,50%)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'hsl(215,15%,45%)')}
                      >
                        ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Create event modal ── */}
      {modalDate !== null && (
        <NewEventModal
          initialDate={modalDate}
          onClose={() => setModalDate(null)}
          onSave={async form => {
            const ok = await createEvent(form);
            if (ok) setModalDate(null);
          }}
        />
      )}
    </div>
  );
}
