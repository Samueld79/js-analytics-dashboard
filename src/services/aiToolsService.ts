import { supabase, isSupabaseConfigured, getErrorMessage } from '../lib/supabase';

export type BrandKit = {
  id: string;
  client_id: string;
  name: string;
  colors: string;
  fonts: string;
  voice: string;
  audiences: string;
  differentiators: string;
  do_not: string;
  created_at: string;
  updated_at: string;
};

export type BrandKitInput = Omit<BrandKit, 'id' | 'created_at' | 'updated_at'>;

export type ToolKnowledgeBase = {
  id: string;
  tool_key: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type ToolOutput = {
  id: string;
  client_id: string;
  tool_key: string;
  inputs: Record<string, string>;
  output: string;
  created_at: string;
};

export type ToolOutputInput = Omit<ToolOutput, 'id' | 'created_at'>;

// ─── Brand Kits ─────────────────────────────────────────────────────────────

export async function listBrandKits(): Promise<BrandKit[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('brand_kits')
    .select('*')
    .order('name');
  if (error) { console.error('[aiTools] listBrandKits', error); return []; }
  return (data ?? []) as BrandKit[];
}

export async function getBrandKitByClient(clientId: string): Promise<BrandKit | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('brand_kits')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) { console.error('[aiTools] getBrandKitByClient', error); return null; }
  return (data ?? null) as BrandKit | null;
}

export async function upsertBrandKit(
  input: BrandKitInput,
): Promise<{ data: BrandKit | null; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { data: null, error: 'Supabase no configurado' };

  const { data, error } = await supabase
    .from('brand_kits')
    .upsert({ ...input, updated_at: new Date().toISOString() }, { onConflict: 'client_id' })
    .select('*')
    .maybeSingle();

  if (error) {
    return { data: null, error: getErrorMessage(error, 'No se pudo guardar el kit') };
  }
  return { data: (data ?? null) as BrandKit | null, error: null };
}

// ─── Tool Knowledge Bases ────────────────────────────────────────────────────

export async function listToolKnowledgeBases(): Promise<ToolKnowledgeBase[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('tool_knowledge_bases')
    .select('*')
    .order('tool_key');
  if (error) { console.error('[aiTools] listToolKnowledgeBases', error); return []; }
  return (data ?? []) as ToolKnowledgeBase[];
}

export async function getToolKnowledgeBase(toolKey: string): Promise<ToolKnowledgeBase | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('tool_knowledge_bases')
    .select('*')
    .eq('tool_key', toolKey)
    .maybeSingle();
  if (error) { console.error('[aiTools] getToolKnowledgeBase', error); return null; }
  return (data ?? null) as ToolKnowledgeBase | null;
}

export async function updateToolKnowledgeBase(
  toolKey: string,
  content: string,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { error: 'Supabase no configurado' };
  const { error } = await supabase
    .from('tool_knowledge_bases')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('tool_key', toolKey);
  if (error) return { error: getErrorMessage(error, 'No se pudo guardar la memoria') };
  return { error: null };
}

// ─── Tool Outputs ────────────────────────────────────────────────────────────

export async function listToolOutputs(opts: {
  clientId?: string;
  toolKey?: string;
  limit?: number;
}): Promise<ToolOutput[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  let q = supabase
    .from('tool_outputs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.clientId) q = q.eq('client_id', opts.clientId);
  if (opts.toolKey) q = q.eq('tool_key', opts.toolKey);
  const { data, error } = await q;
  if (error) { console.error('[aiTools] listToolOutputs', error); return []; }
  return (data ?? []) as ToolOutput[];
}

export async function insertToolOutput(
  input: ToolOutputInput,
): Promise<{ data: ToolOutput | null; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { data: null, error: 'Supabase no configurado' };
  const { data, error } = await supabase
    .from('tool_outputs')
    .insert(input)
    .select('*')
    .maybeSingle();
  if (error) return { data: null, error: getErrorMessage(error, 'No se pudo guardar el resultado') };
  return { data: (data ?? null) as ToolOutput | null, error: null };
}

export async function deleteToolOutput(id: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { error: 'Supabase no configurado' };
  const { error } = await supabase.from('tool_outputs').delete().eq('id', id);
  if (error) return { error: getErrorMessage(error, 'No se pudo eliminar') };
  return { error: null };
}

// ─── AI Generation Proxy ─────────────────────────────────────────────────────

export type AIGenerateParams = {
  prompt: string;
  system?: string;
  max_tokens?: number;
  images?: Array<{ data: string; media_type: string }>;
};

export async function callAI(params: AIGenerateParams): Promise<string> {
  const res = await fetch('/api/ai-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    let errMsg = `Error ${res.status}`;
    try { const j = await res.json(); errMsg = j.error ?? errMsg; } catch { /* ignore */ }
    throw new Error(errMsg);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('Respuesta vacía del modelo');
  return text as string;
}
