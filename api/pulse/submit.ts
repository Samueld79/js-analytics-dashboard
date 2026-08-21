import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, setCors } from '../portal/_lib.js';

const TAG_OPTIONS = ['Reportes', 'Comunicación', 'Resultados', 'Creatividad', 'Rapidez'];
const NOTE_MAX_LENGTH = 2000;

function currentMonthFirstDay(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function moodLabelFromScore(score: number): string {
  if (score <= 20) return 'Muy mal';
  if (score <= 40) return 'Mal';
  if (score <= 60) return 'Regular';
  if (score <= 80) return 'Bien';
  return 'Excelente';
}

function isValidTagList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((t) => typeof t === 'string' && TAG_OPTIONS.includes(t));
}

// Never trusts the client for client_id, month, or mood_label — all derived
// server-side from the slug and the current date. This is the only write
// path into pulse_responses; anon has no direct table access at all.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase no configurado en el servidor.' });

  const { slug, mood_score, liked_tags, improve_tags, note } = req.body as {
    slug?: string;
    mood_score?: number;
    liked_tags?: unknown;
    improve_tags?: unknown;
    note?: string;
  };

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Solicitud inválida.' });
  }
  if (!Number.isFinite(mood_score) || (mood_score as number) < 0 || (mood_score as number) > 100) {
    return res.status(400).json({ error: 'El ánimo debe estar entre 0 y 100.' });
  }
  if (!isValidTagList(liked_tags) || liked_tags.length === 0) {
    return res.status(400).json({ error: 'Elegí al menos una opción de lo que te gustó.' });
  }
  if (improve_tags !== undefined && !isValidTagList(improve_tags)) {
    return res.status(400).json({ error: 'Categoría de mejora inválida.' });
  }
  if (note != null && (typeof note !== 'string' || note.length > NOTE_MAX_LENGTH)) {
    return res.status(400).json({ error: 'El comentario es demasiado largo.' });
  }

  const { data: settings, error: settingsError } = await supabase
    .from('pulse_settings')
    .select('client_id, enabled')
    .eq('public_slug', slug)
    .maybeSingle();

  if (settingsError || !settings || !settings.enabled) {
    return res.status(404).json({ error: 'Enlace no válido o inactivo.' });
  }

  const month = currentMonthFirstDay();

  const { data: existing } = await supabase
    .from('pulse_responses')
    .select('id')
    .eq('client_id', settings.client_id)
    .eq('month', month)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: 'Ya registramos tu respuesta de este mes.' });
  }

  const { data, error } = await supabase
    .from('pulse_responses')
    .insert({
      client_id: settings.client_id,
      month,
      mood_score,
      mood_label: moodLabelFromScore(mood_score as number),
      liked_tags,
      improve_tags: improve_tags ?? [],
      note: note?.trim() || null,
      submitted_at: new Date().toISOString(),
    })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[pulse/submit]', error);
    // Unique violation on (client_id, month) — a second tab/request beat us to it.
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya registramos tu respuesta de este mes.' });
    }
    return res.status(500).json({ error: 'No se pudo guardar tu respuesta.' });
  }

  return res.status(200).json(data);
}
