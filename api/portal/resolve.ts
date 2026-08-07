import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, setCors } from './_lib.js';

// Resolves a public slug to the client it belongs to. Never returns the PINs —
// client_portal_settings has zero anon access, so this is the only way the
// public page learns which client_id a slug maps to.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase no configurado en el servidor.' });

  const { slug } = req.body as { slug?: string };
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'El campo "slug" es requerido.' });
  }

  const { data: settings, error } = await supabase
    .from('client_portal_settings')
    .select('client_id, enabled')
    .eq('public_slug', slug)
    .maybeSingle();

  if (error) {
    console.error('[portal/resolve]', error);
    return res.status(500).json({ error: 'Error al resolver el enlace.' });
  }

  if (!settings || !settings.enabled) {
    return res.status(404).json({ error: 'Enlace no válido o inactivo.' });
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('name, logo_url')
    .eq('id', settings.client_id)
    .maybeSingle();

  if (clientError || !client) {
    console.error('[portal/resolve] client lookup', clientError);
    return res.status(404).json({ error: 'Enlace no válido o inactivo.' });
  }

  return res.status(200).json({
    client_id: settings.client_id,
    enabled: settings.enabled,
    name: client.name,
    logo_url: client.logo_url,
  });
}
