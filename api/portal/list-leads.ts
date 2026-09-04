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
    .select('id, tipo, nombre_cliente, numero_contacto, created_at, daily_entry:portal_daily_entries(campaign_id)')
    .eq('client_id', settings.client_id)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[portal/list-leads]', error);
    return res.status(500).json({ error: 'No se pudo cargar el listado.' });
  }

  // Flatten the joined campaign_id — the public page only needs to know
  // whether a lead came from a tracked ad or from PORTAL_NO_AD_CAMPAIGN_ID,
  // not the shape of the join itself.
  const rows = (data ?? []).map((row) => {
    const dailyEntry = row.daily_entry as unknown as { campaign_id: string } | { campaign_id: string }[] | null;
    const campaign_id = Array.isArray(dailyEntry) ? dailyEntry[0]?.campaign_id ?? null : dailyEntry?.campaign_id ?? null;
    return {
      id: row.id,
      tipo: row.tipo,
      nombre_cliente: row.nombre_cliente,
      numero_contacto: row.numero_contacto,
      created_at: row.created_at,
      campaign_id,
    };
  });

  return res.status(200).json(rows);
}
