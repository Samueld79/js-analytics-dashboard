import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkPin, getSupabaseAdmin, setCors } from './_lib.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIPOS = ['cita', 'compra'];

// Atomically decrements citas/compras AND deletes the most recent matching
// lead row via the portal_remove_last_lead RPC — used for typo corrections,
// no name/contact form required.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase no configurado en el servidor.' });

  const { slug, pin, date, campaign_id, tipo } = req.body as {
    slug?: string;
    pin?: string;
    date?: string;
    campaign_id?: string;
    tipo?: string;
  };

  if (!slug || !date || !DATE_PATTERN.test(date) || !campaign_id || !TIPOS.includes(tipo ?? '')) {
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

  const { data, error } = await supabase.rpc('portal_remove_last_lead', {
    p_client_id: settings.client_id,
    p_date: date,
    p_campaign_id: campaign_id,
    p_tipo: tipo,
  });

  if (error) {
    console.error('[portal/remove-last-lead]', error);
    return res.status(500).json({ error: 'No se pudo corregir el registro.' });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return res.status(200).json(row);
}
