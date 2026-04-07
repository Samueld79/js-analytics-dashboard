import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import type { DailyChecklistEntry } from '../lib/supabase';
import {
  getTodayStr,
  getISOWeekNumber,
  getWeekRange,
  loadTodayEntries,
  loadWeekEntries,
  upsertEntry,
} from '../services/checklist';

// ─── Task definitions ─────────────────────────────────────────────────────

interface ChecklistTask {
  id: string;
  name: string;
  points: number;
}

const JUANCA_TASKS: ChecklistTask[] = [
  { id: 'meta_strategy',     name: 'Ejecuta estrategias en Meta Ads',       points: 30 },
  { id: 'metrics_analysis',  name: 'Análisis de métricas',                   points: 25 },
  { id: 'campaign_review',   name: 'Revisión de campañas diariamente',       points: 30 },
  { id: 'group_comms',       name: 'Comunicación constante en los grupos',   points: 15 },
];

const SAMUEL_TASKS: ChecklistTask[] = [
  { id: 'meta_campaigns',    name: 'Ejecuta campañas en Meta Ads',           points: 25 },
  { id: 'metrics_analysis',  name: 'Análisis de métricas',                   points: 20 },
  { id: 'daily_optimization',name: 'Optimización y seguimiento diario',      points: 30 },
  { id: 'weekly_report',     name: 'Reporte semanal',                        points: 15 },
  { id: 'group_comms',       name: 'Comunicación constante en los grupos',   points: 10 },
];

const MAX_POINTS = { juanca: 100, samuel: 100 };

const USER_META = {
  juanca: { label: 'Juan Camilo', initials: 'JC', color: '#00e5ff', bg: 'hsl(180 100% 50% / 0.12)', border: 'hsl(180 100% 50% / 0.25)', tasks: JUANCA_TASKS },
  samuel: { label: 'Samuel Díaz', initials: 'SD', color: '#7c3aed', bg: 'hsl(270 80% 50% / 0.12)', border: 'hsl(270 80% 50% / 0.25)', tasks: SAMUEL_TASKS },
} as const;

// ─── Condition levels ─────────────────────────────────────────────────────

interface ConditionLevel {
  label: string;
  emoji: string;
  color: string;
  bg: string;
  phrase: string;
}

function getCondition(pct: number): ConditionLevel {
  if (pct >= 95) return { label: 'Cambio de Poder', emoji: '⚡', color: 'hsl(180,100%,50%)',  bg: 'hsl(180 100% 50% / 0.12)', phrase: 'Rendimiento excepcional. Equipo en modo élite.' };
  if (pct >= 85) return { label: 'Poder',           emoji: '🔵', color: 'hsl(215,80%,65%)',   bg: 'hsl(215 80% 65% / 0.12)', phrase: 'Excelente disciplina. Mantengan este ritmo.' };
  if (pct >= 70) return { label: 'Afluencia',        emoji: '🟢', color: 'hsl(145,100%,50%)',  bg: 'hsl(145 100% 45% / 0.1)', phrase: 'Buen ritmo, mantener consistencia diaria.' };
  if (pct >= 55) return { label: 'Normal',           emoji: '🟡', color: 'hsl(50,100%,55%)',   bg: 'hsl(50 100% 55% / 0.1)',  phrase: 'Funcionando bien. Espacio para mejorar.' };
  if (pct >= 40) return { label: 'Emergencia',       emoji: '🟠', color: 'hsl(30,100%,55%)',   bg: 'hsl(30 100% 55% / 0.1)',  phrase: 'Atención necesaria. Reforzar rutinas.' };
  return           { label: 'Peligro',          emoji: '🔴', color: 'hsl(0,84%,60%)',    bg: 'hsl(0 84% 60% / 0.1)',   phrase: 'Acción inmediata. Retomar el ritmo hoy.' };
}

// ─── Stats helpers ────────────────────────────────────────────────────────

type WeekEntry = Pick<DailyChecklistEntry, 'user_name' | 'date' | 'task_id' | 'task_points' | 'completed'>;

function computeWeekPct(user: 'juanca' | 'samuel', entries: WeekEntry[], daysElapsed: number): number {
  const pts = entries
    .filter((e) => e.user_name === user && e.completed)
    .reduce((sum, e) => sum + e.task_points, 0);
  const maxPossible = MAX_POINTS[user] * daysElapsed;
  if (maxPossible === 0) return 0;
  return Math.min(100, Math.round((pts / maxPossible) * 100));
}

function computeDayPct(user: 'juanca' | 'samuel', entries: DailyChecklistEntry[]): number {
  const pts = entries
    .filter((e) => e.user_name === user && e.completed)
    .reduce((sum, e) => sum + e.task_points, 0);
  return Math.min(100, Math.round((pts / MAX_POINTS[user]) * 100));
}

function getPerfectDays(user: 'juanca' | 'samuel', entries: WeekEntry[]): number {
  const byDate = new Map<string, number>();
  entries.filter((e) => e.user_name === user && e.completed).forEach((e) => {
    byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.task_points);
  });
  return [...byDate.values()].filter((pts) => pts >= MAX_POINTS[user]).length;
}

// ─── Sub-components ───────────────────────────────────────────────────────

function ProgressBar({ pct, color, height = 6 }: { pct: number; color: string; height?: number }) {
  return (
    <div
      style={{
        height,
        borderRadius: height,
        background: 'rgba(255,255,255,0.07)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: height,
          background: color,
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export function WeeklyPerformance() {
  const today = getTodayStr();
  const { weekStart, weekEnd, daysElapsed } = getWeekRange();

  const [todayEntries, setTodayEntries] = useState<DailyChecklistEntry[]>([]);
  const [weekEntries, setWeekEntries] = useState<WeekEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [todayRes, weekRes] = await Promise.all([
      loadTodayEntries(today),
      loadWeekEntries(weekStart, weekEnd),
    ]);

    if (todayRes.error?.includes('does not exist') || weekRes.error?.includes('does not exist')) {
      setTableError(true);
      setLoading(false);
      return;
    }

    setTodayEntries((todayRes.data as DailyChecklistEntry[]) ?? []);
    setWeekEntries(weekRes.data ?? []);
    setLoading(false);
  }

  async function handleToggle(
    userName: 'juanca' | 'samuel',
    task: ChecklistTask,
    currentCompleted: boolean,
  ) {
    const key = `${userName}:${task.id}`;
    setSaving((s) => ({ ...s, [key]: true }));

    const newCompleted = !currentCompleted;

    // Optimistic update
    setTodayEntries((prev) => {
      const exists = prev.find((e) => e.user_name === userName && e.task_id === task.id);
      if (exists) {
        return prev.map((e) =>
          e.user_name === userName && e.task_id === task.id
            ? { ...e, completed: newCompleted }
            : e,
        );
      }
      return [
        ...prev,
        {
          id: `tmp-${key}`,
          user_name: userName,
          task_id: task.id,
          task_name: task.name,
          task_points: task.points,
          completed: newCompleted,
          date: today,
          week_number: getISOWeekNumber(new Date()),
          year: new Date().getFullYear(),
          created_at: new Date().toISOString(),
        },
      ];
    });

    const { error } = await upsertEntry({
      user_name: userName,
      task_id: task.id,
      task_name: task.name,
      task_points: task.points,
      completed: newCompleted,
      date: today,
      week_number: getISOWeekNumber(new Date()),
      year: new Date().getFullYear(),
    });

    if (error) {
      // Revert on error
      await loadData();
    } else {
      // Refresh week data without full reload
      const weekRes = await loadWeekEntries(weekStart, weekEnd);
      if (weekRes.data) setWeekEntries(weekRes.data);
    }

    setSaving((s) => ({ ...s, [key]: false }));
  }

  // ── Stats ──
  const juancaDayPct  = computeDayPct('juanca', todayEntries);
  const samuelDayPct  = computeDayPct('samuel', todayEntries);
  const juancaWeekPct = computeWeekPct('juanca', weekEntries, daysElapsed);
  const samuelWeekPct = computeWeekPct('samuel', weekEntries, daysElapsed);
  const companyPct    = Math.round((juancaWeekPct + samuelWeekPct) / 2);
  const condition     = getCondition(companyPct);

  const juancaPerfect = getPerfectDays('juanca', weekEntries);
  const samuelPerfect = getPerfectDays('samuel', weekEntries);
  const leaderUser    = juancaWeekPct >= samuelWeekPct ? 'juanca' : 'samuel';

  const juancaTasksDoneToday = todayEntries.filter((e) => e.user_name === 'juanca' && e.completed).length;
  const samuelTasksDoneToday = todayEntries.filter((e) => e.user_name === 'samuel' && e.completed).length;

  // ── Render helpers ──
  if (!isSupabaseConfigured) {
    return (
      <div
        className="card-glass"
        style={{ padding: '14px 18px', marginBottom: 16, fontSize: '0.78rem', color: 'hsl(215,15%,50%)' }}
      >
        ⚡ Rendimiento semanal requiere Supabase configurado. Ejecuta el SQL de creación de tabla <code>daily_checklist</code>.
      </div>
    );
  }

  if (tableError) {
    return (
      <div
        className="card-glass"
        style={{ padding: '14px 18px', marginBottom: 16 }}
      >
        <p style={{ fontSize: '0.78rem', color: 'hsl(38,100%,60%)', margin: '0 0 8px' }}>
          ⚠ Tabla <code>daily_checklist</code> no encontrada. Ejecuta este SQL en Supabase:
        </p>
        <pre style={{ fontSize: '0.68rem', color: 'hsl(215,15%,55%)', margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'JetBrains Mono, monospace', background: 'rgba(0,0,0,0.3)', padding: '10px 12px', borderRadius: 6 }}>
{`create table public.daily_checklist (
  id          uuid  default gen_random_uuid() primary key,
  user_name   text  not null check (user_name in ('juanca','samuel')),
  task_id     text  not null,
  task_name   text  not null,
  task_points int   not null default 0,
  completed   boolean not null default false,
  date        date  not null default current_date,
  week_number int   not null,
  year        int   not null,
  created_at  timestamptz not null default now(),
  unique (user_name, task_id, date)
);
alter table public.daily_checklist enable row level security;
create policy "Allow all" on public.daily_checklist for all using (true);`}
        </pre>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {/* ── Section header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: collapsed ? 0 : 10,
          cursor: 'pointer',
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span
          style={{
            fontSize: '0.58rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'hsl(180,100%,50%)',
            fontFamily: 'JetBrains Mono',
          }}
        >
          RENDIMIENTO SEMANAL
        </span>
        <div style={{ flex: 1, height: 1, background: 'hsl(180 100% 50% / 0.12)' }} />
        {!loading && (
          <span
            style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 10,
              background: condition.bg,
              color: condition.color,
              border: `1px solid ${condition.color}40`,
              fontFamily: 'JetBrains Mono',
            }}
          >
            {condition.emoji} {companyPct}%
          </span>
        )}
        <span style={{ fontSize: '0.7rem', color: 'hsl(215,15%,40%)', userSelect: 'none' }}>
          {collapsed ? '▸' : '▾'}
        </span>
      </div>

      {collapsed && <div style={{ marginBottom: 8 }} />}

      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div style={{ padding: '18px 0', textAlign: 'center', fontSize: '0.76rem', color: 'hsl(215,15%,40%)' }}>
              Cargando rendimiento...
            </div>
          ) : (
            <>
              {/* ── Block 1: Company condition ── */}
              <div
                className="card-glass"
                style={{
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: condition.bg,
                  borderColor: `${condition.color}30`,
                }}
              >
                <span style={{ fontSize: '1.2rem', lineHeight: 1, flexShrink: 0 }}>{condition.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: condition.color, fontFamily: 'JetBrains Mono' }}>
                      {condition.label}
                    </span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: condition.color }}>
                      {companyPct}%
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'hsl(215,15%,55%)' }}>
                      · {condition.phrase}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Blocks 2 + 3: Checklists | Comparison ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

                {/* Block 2: Checklists (both users stacked) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(['juanca', 'samuel'] as const).map((userName) => {
                    const meta   = USER_META[userName];
                    const tasks  = meta.tasks;
                    const dayPct = userName === 'juanca' ? juancaDayPct : samuelDayPct;

                    return (
                      <div
                        key={userName}
                        className="card-glass"
                        style={{ padding: '10px 12px', borderColor: meta.border }}
                      >
                        {/* User header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <div
                            style={{
                              width: 28, height: 28, borderRadius: '50%',
                              background: meta.bg,
                              border: `2px solid ${meta.color}50`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.62rem', fontWeight: 700, color: meta.color,
                              fontFamily: 'JetBrains Mono', flexShrink: 0,
                            }}
                          >
                            {meta.initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: meta.color }}>
                                {meta.label}
                              </span>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: meta.color, fontFamily: 'JetBrains Mono' }}>
                                {dayPct}%
                              </span>
                            </div>
                            <ProgressBar pct={dayPct} color={meta.color} height={4} />
                          </div>
                        </div>

                        {/* Task list */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {tasks.map((task) => {
                            const entry = todayEntries.find(
                              (e) => e.user_name === userName && e.task_id === task.id,
                            );
                            const checked = entry?.completed ?? false;
                            const isSaving = saving[`${userName}:${task.id}`] ?? false;

                            return (
                              <label
                                key={task.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  cursor: isSaving ? 'wait' : 'pointer',
                                  padding: '4px 6px',
                                  borderRadius: 6,
                                  background: checked ? `${meta.color}12` : 'transparent',
                                  transition: 'background 0.15s',
                                  userSelect: 'none',
                                }}
                              >
                                {/* Custom checkbox */}
                                <div
                                  onClick={() => { if (!isSaving) void handleToggle(userName, task, checked); }}
                                  style={{
                                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                                    border: checked ? `2px solid ${meta.color}` : '2px solid rgba(255,255,255,0.2)',
                                    background: checked ? meta.color : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.15s',
                                    transform: checked ? 'scale(1.1)' : 'scale(1)',
                                  }}
                                >
                                  {checked && (
                                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                      <path d="M1 3L3.5 5.5L8 1" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </div>

                                <span
                                  style={{
                                    flex: 1,
                                    fontSize: '0.71rem',
                                    color: checked ? 'hsl(215,15%,55%)' : 'hsl(215,15%,80%)',
                                    textDecoration: checked ? 'line-through' : 'none',
                                    lineHeight: 1.3,
                                    transition: 'all 0.15s',
                                  }}
                                >
                                  {task.name}
                                </span>

                                <span
                                  style={{
                                    fontSize: '0.6rem',
                                    fontWeight: 700,
                                    padding: '1px 5px',
                                    borderRadius: 4,
                                    background: checked ? `${meta.color}20` : 'rgba(255,255,255,0.05)',
                                    color: checked ? meta.color : 'hsl(215,15%,40%)',
                                    fontFamily: 'JetBrains Mono',
                                    flexShrink: 0,
                                    transition: 'all 0.15s',
                                  }}
                                >
                                  {task.points}pts
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Block 3: Weekly comparison */}
                <div className="card-glass" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span
                    style={{
                      fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em',
                      color: 'hsl(180,100%,50%)', fontFamily: 'JetBrains Mono',
                    }}
                  >
                    SEMANA ACTUAL
                  </span>

                  {/* Leader badge */}
                  {(juancaWeekPct > 0 || samuelWeekPct > 0) && (
                    <div
                      style={{
                        padding: '8px 12px', borderRadius: 8,
                        background: USER_META[leaderUser].bg,
                        border: `1px solid ${USER_META[leaderUser].color}30`,
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                    >
                      <span style={{ fontSize: '0.9rem' }}>🏆</span>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: USER_META[leaderUser].color }}>
                          Mejor semana
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'hsl(215,15%,55%)' }}>
                          {USER_META[leaderUser].label} · {juancaWeekPct === samuelWeekPct ? 'Empate!' : `${Math.max(juancaWeekPct, samuelWeekPct)}%`}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* User comparison rows */}
                  {(['juanca', 'samuel'] as const).map((userName) => {
                    const meta    = USER_META[userName];
                    const weekPct = userName === 'juanca' ? juancaWeekPct : samuelWeekPct;
                    const perfect = userName === 'juanca' ? juancaPerfect : samuelPerfect;
                    const isLeader = userName === leaderUser && juancaWeekPct !== samuelWeekPct;

                    return (
                      <div key={userName} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              width: 26, height: 26, borderRadius: '50%',
                              background: meta.bg,
                              border: `2px solid ${isLeader ? meta.color : `${meta.color}50`}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.58rem', fontWeight: 700, color: meta.color,
                              fontFamily: 'JetBrains Mono', flexShrink: 0,
                            }}
                          >
                            {meta.initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                              <span style={{ fontSize: '0.72rem', color: 'hsl(215,15%,75%)' }}>{meta.label}</span>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: meta.color, fontFamily: 'JetBrains Mono' }}>
                                {weekPct}%
                              </span>
                            </div>
                            <ProgressBar pct={weekPct} color={meta.color} height={5} />
                          </div>
                        </div>

                        {/* Badges */}
                        <div style={{ display: 'flex', gap: 4, paddingLeft: 34, flexWrap: 'wrap' }}>
                          {perfect > 0 && (
                            <span
                              style={{
                                fontSize: '0.6rem', padding: '1px 6px', borderRadius: 4,
                                background: `${meta.color}15`, color: meta.color,
                                border: `1px solid ${meta.color}30`, fontFamily: 'JetBrains Mono',
                              }}
                            >
                              ⚡ {perfect} día{perfect !== 1 ? 's' : ''} completo{perfect !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Head-to-head bar */}
                  {(juancaWeekPct > 0 || samuelWeekPct > 0) && (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ fontSize: '0.6rem', color: 'hsl(215,15%,40%)', marginBottom: 5, letterSpacing: '0.04em' }}>
                        JC vs SD · esta semana
                      </div>
                      <div style={{ height: 8, borderRadius: 8, overflow: 'hidden', display: 'flex' }}>
                        <div
                          style={{
                            flex: juancaWeekPct || 0.5,
                            background: USER_META.juanca.color,
                            transition: 'flex 0.4s ease',
                          }}
                        />
                        <div style={{ width: 2, background: 'hsl(220,22%,7%)' }} />
                        <div
                          style={{
                            flex: samuelWeekPct || 0.5,
                            background: USER_META.samuel.color,
                            transition: 'flex 0.4s ease',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                        <span style={{ fontSize: '0.6rem', color: USER_META.juanca.color, fontFamily: 'JetBrains Mono' }}>
                          JC {juancaWeekPct}%
                        </span>
                        <span style={{ fontSize: '0.6rem', color: USER_META.samuel.color, fontFamily: 'JetBrains Mono' }}>
                          SD {samuelWeekPct}%
                        </span>
                      </div>
                    </div>
                  )}

                  {juancaWeekPct === 0 && samuelWeekPct === 0 && (
                    <p style={{ fontSize: '0.72rem', color: 'hsl(215,15%,40%)', textAlign: 'center', margin: 0 }}>
                      Completa tareas para ver la comparativa
                    </p>
                  )}
                </div>
              </div>

              {/* ── Block 4: Mini stats ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {/* Juanca mini */}
                <div className="card-glass" style={{ padding: '10px 12px', borderColor: USER_META.juanca.border }}>
                  <div style={{ fontSize: '0.6rem', fontWeight: 700, color: USER_META.juanca.color, letterSpacing: '0.08em', fontFamily: 'JetBrains Mono', marginBottom: 6 }}>
                    JUAN CAMILO
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <StatRow label="Hoy" value={`${juancaDayPct}%`} color={USER_META.juanca.color} />
                    <StatRow label="Semana" value={`${juancaWeekPct}%`} color={USER_META.juanca.color} />
                    <StatRow label="Tareas hoy" value={`${juancaTasksDoneToday}/${JUANCA_TASKS.length}`} color={USER_META.juanca.color} />
                  </div>
                </div>

                {/* Samuel mini */}
                <div className="card-glass" style={{ padding: '10px 12px', borderColor: USER_META.samuel.border }}>
                  <div style={{ fontSize: '0.6rem', fontWeight: 700, color: USER_META.samuel.color, letterSpacing: '0.08em', fontFamily: 'JetBrains Mono', marginBottom: 6 }}>
                    SAMUEL DÍAZ
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <StatRow label="Hoy" value={`${samuelDayPct}%`} color={USER_META.samuel.color} />
                    <StatRow label="Semana" value={`${samuelWeekPct}%`} color={USER_META.samuel.color} />
                    <StatRow label="Tareas hoy" value={`${samuelTasksDoneToday}/${SAMUEL_TASKS.length}`} color={USER_META.samuel.color} />
                  </div>
                </div>

                {/* Company mini */}
                <div className="card-glass" style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'hsl(180,100%,50%)', letterSpacing: '0.08em', fontFamily: 'JetBrains Mono', marginBottom: 6 }}>
                    EMPRESA
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <StatRow label="Promedio" value={`${companyPct}%`} color={condition.color} />
                    <StatRow label="Condición" value={condition.label} color={condition.color} />
                    <StatRow label="Día" value={`${new Date().toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' })}`} color="hsl(215,15%,55%)" />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.67rem', color: 'hsl(215,15%,48%)' }}>{label}</span>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, color, fontFamily: 'JetBrains Mono' }}>{value}</span>
    </div>
  );
}
