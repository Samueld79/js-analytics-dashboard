import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, isValidPin, setCors } from './_lib';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase no configurado en el servidor.' });

  const { slug, pin, date, total_sales } = req.body as {
    slug?: string;
    pin?: string;
    date?: string;
    total_sales?: number;
  };

  if (!slug || !isValidPin(pin) || !date || !DATE_PATTERN.test(date)) {
    return res.status(400).json({ error: 'Solicitud inválida.' });
  }
  if (!Number.isFinite(total_sales) || (total_sales as number) <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a 0.' });
  }

  const { data: settings, error: settingsError } = await supabase
    .from('client_portal_settings')
    .select('client_id, pin_ventas, enabled')
    .eq('public_slug', slug)
    .maybeSingle();

  if (settingsError || !settings || !settings.enabled) {
    return res.status(404).json({ error: 'Enlace no válido o inactivo.' });
  }
  if (pin !== settings.pin_ventas) {
    return res.status(403).json({ error: 'PIN incorrecto.' });
  }

  const { data, error } = await supabase
    .from('daily_sales')
    .upsert(
      {
        client_id: settings.client_id,
        date,
        total_sales: Math.round((total_sales as number) * 100) / 100,
        source: 'client_portal',
        status: 'submitted',
      },
      { onConflict: 'client_id,date' },
    )
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[portal/save-sale]', error);
    return res.status(500).json({ error: 'No se pudo registrar la venta.' });
  }

  return res.status(200).json(data);
}
