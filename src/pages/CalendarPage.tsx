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
import { colombiaEvents2026 } from '../data/colombiaEvents2026';

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
      setError('disconnected');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(READ_URL);
      const data: unknown = await res.json();
      const normalize = (d: unknown): CalEvent[] => {
        if (!d) return [];
        if (Array.isArray(d)) {
          if ((d as { json?: unknown }[])[0]?.json) return (d as { json: CalEvent }[]).map((item) => item.json);
          return d as CalEvent[];
        }
        if ((d as { json?: CalEvent }).json) return [(d as { json: CalEvent }).json];
        return [d as CalEvent];
      };
      setEvents(normalize(data));
      setError(null);
      setLastFetch(new Date());
    } catch {
      setError('disconnected');
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

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function CalendarPage() {
  const { events, loading, error, lastFetch, createEvent } = useGoogleCalendarEvents();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [showFestivos, setShowFestivos] = useState(true);
  const [showComerciales, setShowComerciales] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const gridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const eventsOnDay = (day: Date) =>
    events.filter(e => isSameDay(new Date(e.start), day));

  const monthEvents = useMemo(() =>
    events
      .filter(e => isSameMonth(new Date(e.start), currentMonth))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    [events, currentMonth],
  );

  const selectedDayEvents = useMemo(() =>
    selectedDay ? events.filter(e => isSameDay(new Date(e.start), selectedDay)) : [],
    [events, selectedDay],
  );

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

  // Next 5 colombia events from today, filtered by toggles
  const upcomingColombia = useMemo(() =>
    colombiaEvents2026
      .filter(e => {
        const days = daysUntil(e.date);
        if (days < 0) return false;
        if (e.type === 'festivo' && !showFestivos) return false;
        if (e.type === 'comercial' && !showComerciales) return false;
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5),
    [showFestivos, showComerciales],
  );

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
            {error ? 'CALENDARIO LOCAL' : 'SINCRONIZADO CON GOOGLE CALENDAR'}
            {lastFetch && !error && ` · ${lastFetch.toLocaleTimeString('es-CO')}`}
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

      {/* ── Info banner (replaces red error) ── */}
      {error && (
        <div style={{ padding: '0 24px 14px' }}>
          <p className="info-banner-block">
            📅 Calendario local activo · Google Calendar desconectado
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
          style={{ padding: '24px' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' } as Transition}
        >
          {/* Month nav */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}>
            <button
              onClick={() => { setCurrentMonth(m => subMonths(m, 1)); setSelectedDay(null); }}
              style={{
                background: 'none', border: '1px solid var(--color-border)',
                borderRadius: '4px', padding: '6px 8px',
                color: 'hsl(215,15%,60%)', cursor: 'pointer',
                display: 'flex', alignItems: 'center',
              }}
            >
              <ChevronLeft size={16} />
            </button>

            <h2 style={{
              fontFamily: 'Outfit, sans-serif', fontSize: '1rem', fontWeight: 600,
              color: 'var(--color-text-primary)', textTransform: 'capitalize',
              letterSpacing: '-0.01em', margin: 0,
            }}>
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </h2>

            <button
              onClick={() => { setCurrentMonth(m => addMonths(m, 1)); setSelectedDay(null); }}
              style={{
                background: 'none', border: '1px solid var(--color-border)',
                borderRadius: '4px', padding: '6px 8px',
                color: 'hsl(215,15%,60%)', cursor: 'pointer',
                display: 'flex', alignItems: 'center',
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Filter toggle pills */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setShowFestivos(v => !v)}
              style={{
                padding: '4px 12px', borderRadius: 20, border: '1px solid',
                fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                borderColor: showFestivos ? 'hsl(0,84%,55%)' : 'rgba(255,255,255,0.1)',
                background: showFestivos ? 'hsl(0 84% 60% / 0.12)' : 'transparent',
                color: showFestivos ? 'hsl(0,84%,65%)' : 'hsl(215,15%,45%)',
              }}
            >
              🔴 Festivos
            </button>
            <button
              onClick={() => setShowComerciales(v => !v)}
              style={{
                padding: '4px 12px', borderRadius: 20, border: '1px solid',
                fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                borderColor: showComerciales ? 'hsl(38,100%,50%)' : 'rgba(255,255,255,0.1)',
                background: showComerciales ? 'hsl(38 100% 55% / 0.12)' : 'transparent',
                color: showComerciales ? 'hsl(38,100%,65%)' : 'hsl(215,15%,45%)',
              }}
            >
              🟡 Comerciales
            </button>
          </div>

          {/* Week day headers */}
          <div className="calendar-grid" style={{ marginBottom: '4px' }}>
            {WEEK_LABELS.map(d => (
              <div
                key={d}
                style={{
                  textAlign: 'center', fontFamily: 'JetBrains Mono',
                  fontSize: '0.6rem', letterSpacing: '0.08em',
                  color: 'hsl(215,15%,45%)', paddingBottom: '8px',
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

              // Colombia events on this day
              const dayKey = format(day, 'yyyy-MM-dd');
              const colEvents = colombiaEvents2026.filter(e => e.date === dayKey);
              const hasFestivo = showFestivos && colEvents.some(e => e.type === 'festivo');
              const hasComercial = showComerciales && colEvents.some(e => e.type === 'comercial');
              const tooltip = colEvents.length > 0
                ? colEvents.map(e => `${e.emoji} ${e.name}`).join(' · ')
                : undefined;

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
                  style={{
                    cursor: inMonth ? 'pointer' : 'default',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                  title={tooltip}
                >
                  <span>{format(day, 'd')}</span>
                  {(hasFestivo || hasComercial) && (
                    <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                      {hasFestivo && (
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'hsl(0,84%,60%)', flexShrink: 0 }} />
                      )}
                      {hasComercial && (
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'hsl(38,100%,55%)', flexShrink: 0 }} />
                      )}
                    </div>
                  )}
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
          <div className="card-glass" style={{ padding: '20px' }}>
            {nextEvent && countdown ? (
              <>
                <span className="number-label" style={{ display: 'block', marginBottom: '12px' }}>
                  PRÓXIMO EVENTO
                </span>
                <h3 style={{
                  fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', fontWeight: 600,
                  color: 'var(--color-text-primary)', letterSpacing: '-0.01em', margin: '0 0 4px', lineHeight: 1.3,
                }}>
                  {nextEvent.title}
                </h3>
                <p className="number-label" style={{ marginBottom: '16px' }}>
                  {format(new Date(nextEvent.start), "d 'de' MMMM · HH:mm", { locale: es })}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '16px' }}>
                  {([
                    { value: countdown.days, label: 'DÍAS' },
                    { value: countdown.hours, label: 'HRS' },
                    { value: countdown.minutes, label: 'MIN' },
                    { value: countdown.seconds, label: 'SEG' },
                  ] as const).map(unit => (
                    <div
                      key={unit.label}
                      style={{
                        background: 'var(--color-bg-input)', border: '1px solid var(--color-border)',
                        borderRadius: '4px', padding: '10px 6px', textAlign: 'center',
                      }}
                    >
                      <AnimatePresence mode="popLayout">
                        <motion.div
                          key={`${unit.label}-${unit.value}`}
                          initial={{ scale: 1.15, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.85, opacity: 0 }}
                          transition={{ duration: 0.15 } as Transition}
                          style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-accent-cyan)', lineHeight: 1 }}
                        >
                          {String(unit.value).padStart(2, '0')}
                        </motion.div>
                      </AnimatePresence>
                      <div className="number-label" style={{ marginTop: '4px', fontSize: '0.58rem' }}>
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
                    style={{ display: 'block', textAlign: 'center', fontSize: '0.7rem', padding: '7px', textDecoration: 'none' }}
                  >
                    Ver en Google Calendar ↗
                  </a>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <Calendar size={28} style={{ color: 'hsl(215,15%,35%)', margin: '0 auto 12px', display: 'block' }} />
                <p className="number-label" style={{ marginBottom: '12px' }}>SIN EVENTOS PRÓXIMOS</p>
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

          {/* Section B: PRÓXIMAS FECHAS CLAVE */}
          <div className="card-glass" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
              <span className="number-label">PRÓXIMAS FECHAS CLAVE</span>
            </div>
            {upcomingColombia.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.76rem', color: 'hsl(215,15%,42%)', fontFamily: 'JetBrains Mono, monospace' }}>
                Sin fechas próximas
              </div>
            ) : (
              <div>
                {upcomingColombia.map(ev => {
                  const days = daysUntil(ev.date);
                  const isToday_ = days === 0;
                  const isFestivo = ev.type === 'festivo';
                  const dateFormatted = new Date(`${ev.date}T00:00:00`)
                    .toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

                  return (
                    <div
                      key={`${ev.date}-${ev.name}`}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '11px 20px', borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <span style={{ fontSize: '1.1rem', flexShrink: 0, lineHeight: 1.4 }}>{ev.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
                          {ev.name}
                        </p>
                        <p style={{ margin: '2px 0 5px', fontSize: '0.63rem', color: 'hsl(215,15%,48%)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {dateFormatted}
                        </p>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {isToday_ ? (
                            <span style={{
                              fontSize: '0.6rem', fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                              background: 'var(--color-info-bg)', color: 'var(--color-info-fg)',
                              fontFamily: 'JetBrains Mono, monospace',
                              border: '1px solid hsl(200 80% 52% / 0.25)',
                            }}>
                              HOY 🎉
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '0.6rem', fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                              background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-secondary)',
                              fontFamily: 'JetBrains Mono, monospace',
                              border: '1px solid var(--color-border)',
                            }}>
                              en {days} días
                            </span>
                          )}
                          <span style={{
                            fontSize: '0.6rem', fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                            fontFamily: 'JetBrains Mono, monospace',
                            background: isFestivo ? 'hsl(0 84% 60% / 0.12)' : 'hsl(38 100% 55% / 0.1)',
                            color: isFestivo ? 'hsl(0,84%,65%)' : 'hsl(38,100%,65%)',
                            border: `1px solid ${isFestivo ? 'hsl(0 84% 60% / 0.25)' : 'hsl(38 100% 55% / 0.25)'}`,
                          }}>
                            {isFestivo ? 'festivo' : 'comercial'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section C: Event list */}
          <div className="card-glass" style={{ overflow: 'hidden' }}>
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span className="number-label" style={{ textTransform: 'capitalize' }}>
                {listLabel}
              </span>
              {selectedDay && (
                <button
                  onClick={() => setSelectedDay(null)}
                  style={{ background: 'none', border: 'none', color: 'hsl(215,15%,45%)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {displayEvents.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'JetBrains Mono', fontSize: '0.72rem', color: 'hsl(215,15%,40%)' }}>
                Sin eventos en este período
              </div>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {displayEvents.map(event => (
                  <div
                    key={event.id}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px',
                      padding: '12px 20px', borderBottom: '1px solid var(--color-border)',
                      transition: 'background 150ms ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'hsl(0 0% 100% / 0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '28px', flexShrink: 0 }}>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-accent-cyan)', lineHeight: 1 }}>
                        {format(new Date(event.start), 'd')}
                      </span>
                      <span className="number-label" style={{ fontSize: '0.55rem', marginTop: '2px', textTransform: 'uppercase' }}>
                        {format(new Date(event.start), 'MMM', { locale: es })}
                      </span>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {event.title}
                      </p>
                      <p className="number-label" style={{ marginTop: '2px', fontSize: '0.62rem' }}>
                        {format(new Date(event.start), 'HH:mm')}
                        {event.end && ` → ${format(new Date(event.end), 'HH:mm')}`}
                      </p>
                      {event.description && (
                        <p style={{ fontFamily: 'JetBrains Mono', fontSize: '0.62rem', color: 'hsl(215,15%,45%)', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                        style={{ color: 'hsl(215,15%,45%)', textDecoration: 'none', fontSize: '0.78rem', flexShrink: 0, transition: 'color 150ms ease' }}
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
