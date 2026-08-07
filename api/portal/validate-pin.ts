import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, isValidPin, setCors } from './_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase no configurado en el servidor.' });

  const { slug, pin, kind } = req.body as { slug?: string; pin?: string; kind?: 'registro' | 'ventas' };
  if (!slug || !isValidPin(pin) || (kind !== 'registro' && kind !== 'ventas')) {
    return res.status(400).json({ error: 'Solicitud inválida.' });
  }

  const { data: settings, error } = await supabase
    .from('client_portal_settings')
    .select('pin_registro, pin_ventas, enabled')
    .eq('public_slug', slug)
    .maybeSingle();

  if (error) {
    console.error('[portal/validate-pin]', error);
    return res.status(500).json({ error: 'Error al validar el PIN.' });
  }

  if (!settings || !settings.enabled) {
    return res.status(404).json({ error: 'Enlace no válido o inactivo.' });
  }

  const expected = kind === 'registro' ? settings.pin_registro : settings.pin_ventas;
  return res.status(200).json({ valid: pin === expected });
}
