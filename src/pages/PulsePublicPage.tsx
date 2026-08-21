import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { GlassCard } from '../components/ui-custom/GlassCard';
import { PrimaryButton } from '../components/ui-custom/PrimaryButton';
import { resolvePulseSlug, submitPulseResponse, type PulseResolveResult } from '../services/pulse';
import { PULSE_MOOD_EMOJI, PULSE_MOOD_LABELS, PULSE_TAG_OPTIONS, pulseMoodLabelFromScore } from '../lib/supabase';

const CONFETTI_COLORS = ['var(--mood-1)', 'var(--mood-2)', 'var(--mood-3)', 'var(--mood-4)', 'var(--mood-5)', 'var(--cyan)'];

function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 350,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: Math.round(Math.random() * 360),
      })),
    [],
  );

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', borderRadius: 'inherit' }}>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="pulse-confetti-piece"
          style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}ms`, transform: `rotate(${p.rotate}deg)` }}
        />
      ))}
    </div>
  );
}

function StepDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 18 }}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          style={{
            width: n === step ? 18 : 6, height: 6, borderRadius: 999,
            background: n <= step ? 'var(--fg)' : 'var(--border)',
            transition: 'all 200ms ease',
          }}
        />
      ))}
    </div>
  );
}

function TagChips({
  selected,
  onToggle,
  tagClicks,
}: {
  selected: string[];
  onToggle: (tag: string) => void;
  tagClicks: Record<string, number>;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
      {PULSE_TAG_OPTIONS.map((tag) => (
        <button
          key={`${tag}-${tagClicks[tag] ?? 0}`}
          type="button"
          onClick={() => onToggle(tag)}
          className={`pulse-chip${selected.includes(tag) ? ' selected' : ''}`}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}

export function PulsePublicPage() {
  const { slug } = useParams<{ slug: string }>();

  const [status, setStatus] = useState<'loading' | 'invalid' | 'error' | 'already' | 'survey' | 'thanks'>('loading');
  const [pulse, setPulse] = useState<PulseResolveResult | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [moodScore, setMoodScore] = useState(50);
  const [likedTags, setLikedTags] = useState<string[]>([]);
  const [improveTags, setImproveTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [likedError, setLikedError] = useState('');
  const [tagClicks, setTagClicks] = useState<Record<string, number>>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (!slug) return;
    resolvePulseSlug(slug).then((result) => {
      if (result.error || !result.data) {
        setStatus(result.status === 404 ? 'invalid' : 'error');
        return;
      }
      setPulse(result.data);
      setStatus(result.data.already_responded ? 'already' : 'survey');
    });
  }, [slug]);

  const moodLabel = pulseMoodLabelFromScore(moodScore);
  const moodEmoji = PULSE_MOOD_EMOJI[moodLabel];
  const moodIndex = PULSE_MOOD_LABELS.indexOf(moodLabel);
  const moodColor = `var(--mood-${moodIndex + 1})`;
  const moodDim = `var(--mood-${moodIndex + 1}-dim)`;

  const bumpTag = (tag: string) => setTagClicks((prev) => ({ ...prev, [tag]: (prev[tag] ?? 0) + 1 }));

  const toggleLiked = (tag: string) => {
    bumpTag(tag);
    setLikedError('');
    setLikedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const toggleImprove = (tag: string) => {
    bumpTag(tag);
    setImproveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleStep2Continue = () => {
    if (likedTags.length === 0) {
      setLikedError('Elegí al menos una opción para continuar.');
      return;
    }
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!slug) return;
    setSubmitting(true);
    setSubmitError('');
    const result = await submitPulseResponse({
      slug,
      mood_score: moodScore,
      liked_tags: likedTags,
      improve_tags: improveTags,
      note,
    });
    setSubmitting(false);
    if (result.data) {
      setStatus('thanks');
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reducedMotion) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1500);
      }
    } else if (result.status === 409) {
      // Someone else submitted for this client/month in the gap between load and submit.
      setStatus('already');
    } else {
      setSubmitError(result.error ?? 'No se pudo guardar tu respuesta.');
    }
  };

  const centeredWrap: CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', padding: 20,
  };

  if (status === 'loading') {
    return (
      <div style={centeredWrap}>
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem' }}>Cargando…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={centeredWrap}>
        <GlassCard style={{ padding: 32, textAlign: 'center', maxWidth: 380 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: 'var(--fg)' }}>Hubo un problema cargando esta página</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--fg-muted)' }}>
            Intenta de nuevo en unos minutos. Si el problema sigue, avisa a tu agencia.
          </p>
        </GlassCard>
      </div>
    );
  }

  if (status === 'invalid' || !pulse) {
    return (
      <div style={centeredWrap}>
        <GlassCard style={{ padding: 32, textAlign: 'center', maxWidth: 380 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: 'var(--fg)' }}>Enlace no válido o inactivo</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--fg-muted)' }}>
            Verifica el link con tu agencia o solicita uno nuevo.
          </p>
        </GlassCard>
      </div>
    );
  }

  if (status === 'already') {
    return (
      <div style={centeredWrap}>
        <GlassCard style={{ padding: 32, textAlign: 'center', maxWidth: 380 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🙏</div>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: 'var(--fg)' }}>Ya registramos tu respuesta de este mes</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--fg-muted)' }}>
            ¡Gracias! Te preguntamos de nuevo el próximo mes.
          </p>
        </GlassCard>
      </div>
    );
  }

  if (status === 'thanks') {
    return (
      <div style={centeredWrap}>
        <GlassCard
          className="pulse-card"
          style={{ padding: 36, textAlign: 'center', maxWidth: 400, position: 'relative', overflow: 'hidden', background: moodDim, borderColor: moodColor }}
        >
          {showConfetti && <ConfettiBurst />}
          <div className="pulse-mood-emoji" style={{ fontSize: '3.2rem', marginBottom: 12 }}>{moodEmoji}</div>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.2rem', color: 'var(--fg)' }}>¡Gracias por tu respuesta!</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--fg-muted)' }}>
            Tu opinión nos ayuda a mejorar cada mes.
          </p>
        </GlassCard>
      </div>
    );
  }

  // ── status === 'survey' ──────────────────────────────────────────────────────
  return (
    <div style={centeredWrap}>
      <GlassCard
        className="pulse-card"
        style={{ padding: 32, width: '100%', maxWidth: 420, background: moodDim, borderColor: moodColor }}
      >
        <StepDots step={step} />

        {step === 1 && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 20px', fontSize: '0.95rem', fontWeight: 600, color: 'var(--fg)' }}>
              ¿Cómo te sentiste este mes con {pulse.name}?
            </p>

            <div key={moodLabel} className="pulse-mood-emoji" style={{ fontSize: '3.6rem', marginBottom: 6 }}>
              {moodEmoji}
            </div>
            <p style={{ margin: '0 0 24px', fontSize: '0.8rem', fontWeight: 600, color: moodColor }}>{moodLabel}</p>

            <input
              type="range"
              min={0}
              max={100}
              value={moodScore}
              onChange={(e) => setMoodScore(Number(e.target.value))}
              className="pulse-slider"
              style={{ '--mood-color': moodColor } as CSSProperties}
              aria-label="Nivel de ánimo"
            />

            <div style={{ marginTop: 28 }}>
              <PrimaryButton className="full" onClick={() => setStep(2)}>Continuar</PrimaryButton>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 18px', fontSize: '0.95rem', fontWeight: 600, color: 'var(--fg)' }}>
              ¿Qué te gustó más este mes?
            </p>
            <TagChips selected={likedTags} onToggle={toggleLiked} tagClicks={tagClicks} />
            {likedError && <p style={{ margin: '12px 0 0', fontSize: '0.76rem', color: 'var(--danger)' }}>{likedError}</p>}
            <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep(1)}>Atrás</button>
              <PrimaryButton className="full" onClick={handleStep2Continue} style={{ flex: 2 }}>Continuar</PrimaryButton>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 18px', fontSize: '0.95rem', fontWeight: 600, color: 'var(--fg)' }}>
              ¿Qué podemos mejorar? <span style={{ fontWeight: 400, color: 'var(--fg-muted)' }}>(opcional)</span>
            </p>
            <TagChips selected={improveTags} onToggle={toggleImprove} tagClicks={tagClicks} />

            <textarea
              className="form-input"
              rows={3}
              placeholder="Contanos más, si querés (opcional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ width: '100%', marginTop: 16, resize: 'vertical', fontFamily: 'inherit' }}
            />

            {submitError && <p style={{ margin: '10px 0 0', fontSize: '0.76rem', color: 'var(--danger)' }}>{submitError}</p>}

            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep(2)} disabled={submitting}>Atrás</button>
              <PrimaryButton className="full" style={{ flex: 2 }} loading={submitting} onClick={() => void handleSubmit()}>
                Enviar
              </PrimaryButton>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
