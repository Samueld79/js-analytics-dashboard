import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkPin, getSupabaseAdmin, setCors } from './_lib.js';

// PIN-gated on purpose (same pin_registro as the rest of "Registro del día",
// respecting pin_required per client) — portal_leads carries real customer
// names and phone numbers, unlike the other portal_* tables the public page
// reads directly (those are pure aggregates with a blanket anon SELECT
// policy). This route runs with the service role and only returns leads for
// the client_id resolved server-side from the slug, never from client input.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase no configurado en el servidor.' });

  const { slug, pin } = req.body as { slug?: string; pin?: string };
  if (!slug) {
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
    .from('portal_leads')
    .select('id, tipo, nombre_cliente, numero_contacto, created_at')
    .eq('client_id', settings.client_id)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[portal/list-leads]', error);
    return res.status(500).json({ error: 'No se pudo cargar el listado.' });
  }

  return res.status(200).json(data ?? []);
}
