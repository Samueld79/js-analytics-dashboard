import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, isValidPin, setCors } from './_lib.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIPOS = ['cita', 'compra'];

// Atomically bumps citas/compras on portal_daily_entries AND records the
// lead (name/contact/monto) via the portal_add_lead RPC — the only way the
// public page can increment these counters, so they can never drift from
// the individual lead rows.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase no configurado en el servidor.' });

  const { slug, pin, date, campaign_id, tipo, nombre_cliente, numero_contacto, monto } = req.body as {
    slug?: string;
    pin?: string;
    date?: string;
    campaign_id?: string;
    tipo?: string;
    nombre_cliente?: string;
    numero_contacto?: string;
    monto?: number | null;
  };

  if (!slug || !isValidPin(pin) || !date || !DATE_PATTERN.test(date) || !campaign_id || !TIPOS.includes(tipo ?? '')) {
    return res.status(400).json({ error: 'Solicitud inválida.' });
  }
  if (!nombre_cliente?.trim() || !numero_contacto?.trim()) {
    return res.status(400).json({ error: 'Nombre y número de contacto son obligatorios.' });
  }
  if (tipo === 'compra' && (!Number.isFinite(monto) || (monto as number) <= 0)) {
    return res.status(400).json({ error: 'El monto es obligatorio para una compra.' });
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

  const { data, error } = await supabase.rpc('portal_add_lead', {
    p_client_id: settings.client_id,
    p_date: date,
    p_campaign_id: campaign_id,
    p_tipo: tipo,
    p_nombre_cliente: nombre_cliente.trim(),
    p_numero_contacto: numero_contacto.trim(),
    p_monto: tipo === 'compra' ? monto : null,
  });

  if (error) {
    console.error('[portal/add-lead]', error);
    return res.status(500).json({ error: 'No se pudo guardar el registro.' });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return res.status(200).json(row);
}
