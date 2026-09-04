import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkPin, getSupabaseAdmin, setCors, PORTAL_NOTE_CAMPAIGN_ID } from './_lib.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Saves the free-text "Nota del día" — one per (client_id, date), gated by
// the same pin_registro that protects citas/compras/objeción/visita.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase no configurado en el servidor.' });

  const { slug, pin, date, nota } = req.body as {
    slug?: string;
    pin?: string;
    date?: string;
    nota?: string;
  };

  if (!slug || !date || !DATE_PATTERN.test(date)) {
    return res.status(400).json({ error: 'Solicitud inválida.' });
  }

  const { data: settings, error: settingsError } = await supabase
    .from('client_portal_settings')
    .select('client_id, pin_registro, pin_required, enabled')
    .eq('public_slug', slug)
    .maybeSingle();

  if (settingsError || !settings || !settings.enabled) {
    return res.status(404).json({ error: 'Enlace no válido o inactivo.' });
  }
  if (!checkPin(pin, settings.pin_required, settings.pin_registro)) {
    return res.status(403).json({ error: 'PIN incorrecto.' });
  }

  const { data, error } = await supabase
    .from('portal_daily_entries')
    .upsert(
      {
        client_id: settings.client_id,
        date,
        campaign_id: PORTAL_NOTE_CAMPAIGN_ID,
        nota: (nota ?? '').trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id,date,campaign_id' },
    )
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[portal/save-daily-note]', error);
    return res.status(500).json({ error: 'No se pudo guardar la nota.' });
  }

  return res.status(200).json(data);
}
