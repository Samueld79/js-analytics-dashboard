import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkPin, getSupabaseAdmin, setCors } from './_lib.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIPOS = ['objecion', 'visita'];
const CATEGORIAS: Record<string, string[]> = {
  objecion: ['Precio', 'Disponibilidad de cita', 'No respondio', 'Indeciso', 'Otro'],
  visita: ['Va a visitar', 'No va a visitar', 'Tal vez'],
};

// Atomically bumps a category tally (objeción/visita) via RPC — no identity
// captured, this is aggregate-only, so no lead modal / PIN-per-write beyond
// the same pin_registro that gates the rest of "Registro del día".
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase no configurado en el servidor.' });

  const { slug, pin, date, ad_id, tipo, categoria } = req.body as {
    slug?: string;
    pin?: string;
    date?: string;
    ad_id?: string;
    tipo?: string;
    categoria?: string;
  };

  if (!slug || !date || !DATE_PATTERN.test(date) || !ad_id || !TIPOS.includes(tipo ?? '')) {
    return res.status(400).json({ error: 'Solicitud inválida.' });
  }
  if (!categoria || !CATEGORIAS[tipo as string].includes(categoria)) {
    return res.status(400).json({ error: 'Categoría inválida.' });
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

  const { data, error } = await supabase.rpc('portal_increment_tally', {
    p_client_id: settings.client_id,
    p_date: date,
    p_ad_id: ad_id,
    p_tipo: tipo,
    p_categoria: categoria,
  });

  if (error) {
    console.error('[portal/increment-tally]', error);
    return res.status(500).json({ error: 'No se pudo guardar el registro.' });
  }

  return res.status(200).json(data);
}
