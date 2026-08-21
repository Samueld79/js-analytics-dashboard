import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, setCors } from '../portal/_lib.js';

function currentMonthFirstDay(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

// Resolves a public Pulso slug to its client, mirroring api/portal/resolve.ts.
// Also tells the page whether this client already answered this month, since
// anon has zero SELECT access to pulse_responses.
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
    .from('pulse_settings')
    .select('client_id, enabled')
    .eq('public_slug', slug)
    .maybeSingle();

  if (error) {
    console.error('[pulse/resolve]', error);
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
    console.error('[pulse/resolve] client lookup', clientError);
    return res.status(404).json({ error: 'Enlace no válido o inactivo.' });
  }

  const { data: existing, error: responseError } = await supabase
    .from('pulse_responses')
    .select('id')
    .eq('client_id', settings.client_id)
    .eq('month', currentMonthFirstDay())
    .maybeSingle();

  if (responseError) {
    console.error('[pulse/resolve] response lookup', responseError);
    return res.status(500).json({ error: 'Error al resolver el enlace.' });
  }

  return res.status(200).json({
    client_id: settings.client_id,
    enabled: settings.enabled,
    name: client.name,
    logo_url: client.logo_url,
    already_responded: Boolean(existing),
  });
}
