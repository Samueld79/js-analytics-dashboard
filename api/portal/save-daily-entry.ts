import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, isValidPin, setCors } from './_lib';

const OBJECTION_VALUES = ['Sin objecion', 'Precio', 'Disponibilidad de cita', 'No respondio', 'Indeciso', 'Otro'];
const VISIT_VALUES = ['Va a visitar', 'No va a visitar', 'Tal vez'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase no configurado en el servidor.' });

  const { slug, pin, date, campaign_id, citas, compras, objecion, visita_punto_fisico } = req.body as {
    slug?: string;
    pin?: string;
    date?: string;
    campaign_id?: string;
    citas?: number;
    compras?: number;
    objecion?: string | null;
    visita_punto_fisico?: string | null;
  };

  if (!slug || !isValidPin(pin) || !date || !DATE_PATTERN.test(date) || !campaign_id) {
    return res.status(400).json({ error: 'Solicitud inválida.' });
  }
  if (objecion != null && !OBJECTION_VALUES.includes(objecion)) {
    return res.status(400).json({ error: 'Valor de objeción inválido.' });
  }
  if (visita_punto_fisico != null && !VISIT_VALUES.includes(visita_punto_fisico)) {
    return res.status(400).json({ error: 'Valor de visita inválido.' });
  }

  const { data: settings, error: settingsError } = await supabase
    .from('client_portal_settings')
    .select('client_id, pin_registro, enabled')
    .eq('public_slug', slug)
    .maybeSingle();

  if (settingsError || !settings || !settings.enabled) {
    return res.status(404).json({ error: 'Enlace no válido o inactivo.' });
  }
  if (pin !== settings.pin_registro) {
    return res.status(403).json({ error: 'PIN incorrecto.' });
  }

  const { data, error } = await supabase
    .from('portal_daily_entries')
    .upsert(
      {
        client_id: settings.client_id,
        date,
        campaign_id,
        citas: Number.isFinite(citas) ? Math.max(0, Math.round(citas as number)) : 0,
        compras: Number.isFinite(compras) ? Math.max(0, Math.round(compras as number)) : 0,
        objecion: objecion ?? null,
        visita_punto_fisico: visita_punto_fisico ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id,date,campaign_id' },
    )
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[portal/save-daily-entry]', error);
    return res.status(500).json({ error: 'No se pudo guardar el registro.' });
  }

  return res.status(200).json(data);
}
