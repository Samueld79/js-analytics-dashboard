import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkPin, getSupabaseAdmin, setCors } from './_lib.js';

// Corrects nombre_cliente/numero_contacto/monto on an existing portal_leads
// row — never touches tipo (that would require also adjusting
// portal_daily_entries.citas/compras, out of scope). Gated by the same
// pin_registro as the rest of Registro/Seguimiento. All the real validation
// (empty name/phone, monto<=0 for a compra, lead belongs to this client)
// lives in the portal_edit_lead RPC — its exception messages are already
// user-facing Spanish, so they're passed straight through.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase no configurado en el servidor.' });

  const { slug, pin, lead_id, nombre_cliente, numero_contacto, monto } = req.body as {
    slug?: string;
    pin?: string;
    lead_id?: string;
    nombre_cliente?: string;
    numero_contacto?: string;
    monto?: number | null;
  };

  if (!slug || !lead_id || !nombre_cliente?.trim() || !numero_contacto?.trim()) {
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

  const { data, error } = await supabase.rpc('portal_edit_lead', {
    p_client_id: settings.client_id,
    p_lead_id: lead_id,
    p_nombre_cliente: nombre_cliente.trim(),
    p_numero_contacto: numero_contacto.trim(),
    p_monto: monto ?? null,
  });

  if (error) {
    console.error('[portal/edit-lead]', error);
    return res.status(400).json({ error: error.message ?? 'No se pudo guardar el cambio.' });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return res.status(200).json(row);
}
