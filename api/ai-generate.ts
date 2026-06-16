import type { VercelRequest, VercelResponse } from '@vercel/node';

// Accept both snake_case (legacy) and camelCase (new) image formats
type ImageInputSnake = { data: string; media_type: string };
type ImageInputCamel = { base64: string; mediaType: string };
type ImageInput = ImageInputSnake | ImageInputCamel;

function normalizeImage(img: ImageInput): { data: string; media_type: string } {
  if ('base64' in img) return { data: img.base64, media_type: img.mediaType };
  return img;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada en el servidor' });

  const { prompt, system, max_tokens = 4000, images } = req.body as {
    prompt: string;
    system?: string;
    max_tokens?: number;
    images?: ImageInput[];
  };

  if (!prompt) return res.status(400).json({ error: 'El campo "prompt" es requerido' });

  const content: object[] = [];
  if (images?.length) {
    for (const img of images) {
      const { data, media_type } = normalizeImage(img);
      content.push({
        type: 'image',
        source: { type: 'base64', media_type, data },
      });
    }
  }
  content.push({ type: 'text', text: prompt });

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens,
        system: system ?? 'Eres un asistente experto.',
        messages: [{ role: 'user', content }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('[ai-generate] Anthropic error:', anthropicRes.status, errText);
      return res.status(anthropicRes.status).json({ error: errText });
    }

    const data = await anthropicRes.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('[ai-generate] fetch error:', err);
    return res.status(500).json({ error: 'Error al conectar con la API de IA' });
  }
}
