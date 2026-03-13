import type {
  ChecklistItem,
  Client,
  MemoryEntry,
  Strategy,
  StrategyInput,
} from '../lib/supabase';
import { getClientByIdOrSlug } from './clients';
import { getClientMemory, listMemoryEntries } from './memory';
import { listStrategies } from './strategies';

type StructuredSections = {
  month?: string;
  monthlyBudget?: number | null;
  ages?: string;
  cities: string[];
  audiences: string[];
  exclusions: string[];
  campaignNewLines: string[];
  campaignOffLines: string[];
  campaignOptimizeLines: string[];
  creativeLines: string[];
  driveLines: string[];
  noteLines: string[];
};

type SectionBucket =
  | 'campaignNewLines'
  | 'campaignOffLines'
  | 'campaignOptimizeLines'
  | 'creativeLines'
  | 'driveLines'
  | 'noteLines';

export type StructuredStrategyResponse = {
  strategy: StrategyInput;
  observations: string[];
  previousSummary: string | null;
};

export type MemoryQueryResponse = {
  answer: string;
  highlights: string[];
};

const MONTH_MAP: Record<string, string> = {
  enero: '01',
  feb: '02',
  febrero: '02',
  mar: '03',
  marzo: '03',
  abr: '04',
  abril: '04',
  may: '05',
  mayo: '05',
  jun: '06',
  junio: '06',
  jul: '07',
  julio: '07',
  ago: '08',
  agosto: '08',
  sep: '09',
  septiembre: '09',
  setiembre: '09',
  oct: '10',
  octubre: '10',
  nov: '11',
  noviembre: '11',
  dic: '12',
  diciembre: '12',
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getCurrentMonthIso(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function parseMoneyToken(token: string): number | null {
  const cleaned = token.replace(/[^\d.,mk]/gi, '').toLowerCase();
  if (!cleaned) return null;

  if (cleaned.endsWith('m')) {
    const base = Number(cleaned.replace('m', '').replace(',', '.'));
    return Number.isFinite(base) ? Math.round(base * 1_000_000) : null;
  }

  if (cleaned.endsWith('k')) {
    const base = Number(cleaned.replace('k', '').replace(',', '.'));
    return Number.isFinite(base) ? Math.round(base * 1_000) : null;
  }

  const normalized = cleaned.includes(',') && !cleaned.includes('.')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMonth(text: string): string | null {
  const normalized = normalizeText(text);

  const explicitDate = normalized.match(/(20\d{2})[-/](\d{2})/);
  if (explicitDate) {
    return `${explicitDate[1]}-${explicitDate[2]}-01`;
  }

  for (const [name, month] of Object.entries(MONTH_MAP)) {
    if (normalized.includes(name)) {
      const yearMatch = normalized.match(/20\d{2}/);
      const year = yearMatch?.[0] ?? String(new Date().getFullYear());
      return `${year}-${month}-01`;
    }
  }

  return null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

function splitList(value: string): string[] {
  return uniqueStrings(
    value
      .split(/[,·|]/)
      .map((item) => item.replace(/^[-*•]\s*/, '').trim()),
  );
}

function parseCampaignLines(
  lines: string[],
  type: 'new' | 'off' | 'optimize',
): StrategyInput['campaigns_new'] {
  return lines
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.includes('|')
        ? line.split('|').map((part) => part.trim())
        : line.split(/\s+-\s+/).map((part) => part.trim());

      if (type === 'new') {
        const [name, objective, budgetValue, audience, notes] = parts;
        return {
          name,
          objective: objective || undefined,
          budget: budgetValue ? parseMoneyToken(budgetValue) ?? undefined : undefined,
          audience: audience || undefined,
          notes: notes || undefined,
        };
      }

      if (type === 'off') {
        const [name, reason] = parts;
        return {
          name,
          reason: reason || undefined,
        };
      }

      const [name, action, priority] = parts;
      return {
        name,
        action: action || undefined,
        priority: priority || undefined,
      };
    })
    .filter((entry) => entry.name);
}

function parseCreativeLines(lines: string[]): StrategyInput['creatives'] {
  return lines
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.includes('|')
        ? line.split('|').map((part) => part.trim())
        : line.split(/\s+-\s+/).map((part) => part.trim());
      const [type, description, link] = parts;
      return {
        type: type || undefined,
        description: description || undefined,
        link: link || undefined,
      };
    })
    .filter((entry) => entry.type || entry.description || entry.link);
}

function extractDriveLinks(rawInput: string, lines: string[]): StrategyInput['drive_links'] {
  const fromSections = lines
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.includes('|')
        ? line.split('|').map((part) => part.trim())
        : [line, line];
      const [label, url] = parts;
      return { label: label || 'Drive', url: url || '' };
    })
    .filter((entry) => /^https?:\/\//i.test(entry.url));

  if (fromSections.length > 0) return fromSections;

  const urls = rawInput.match(/https?:\/\/[^\s)]+/g) ?? [];
  return urls
    .filter((url) => /drive\.google|docs\.google|forms\.gle/i.test(url))
    .map((url, index) => ({
      label: `Drive ${index + 1}`,
      url,
    }));
}

function detectTitle(rawInput: string, client: Client): string {
  const firstMeaningfulLine = rawInput
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !/:/.test(line));

  if (firstMeaningfulLine && firstMeaningfulLine.length <= 70) {
    return firstMeaningfulLine;
  }

  const month = parseMonth(rawInput)?.slice(0, 7) ?? getCurrentMonthIso().slice(0, 7);
  return `Estrategia ${month} - ${client.name}`;
}

function buildDiff(current: StrategyInput, previous: Strategy | null): string | null {
  if (!previous) return 'Primera estrategia registrada para este cliente.';

  const parts: string[] = [];

  if (current.monthly_budget != null && previous.monthly_budget != null) {
    const delta = current.monthly_budget - previous.monthly_budget;
    if (delta !== 0) {
      parts.push(`Presupuesto ${delta > 0 ? 'sube' : 'baja'} ${Intl.NumberFormat('es-CO').format(Math.abs(delta))}`);
    }
  }

  if (current.campaigns_new.length !== previous.campaigns_new.length) {
    parts.push(
      `${current.campaigns_new.length} campanas nuevas vs ${previous.campaigns_new.length} en la anterior`,
    );
  }

  const previousAudiences = new Set(previous.segmentation.audiences ?? []);
  const newAudiences = (current.segmentation.audiences ?? []).filter(
    (audience) => !previousAudiences.has(audience),
  );
  if (newAudiences.length > 0) {
    parts.push(`Nuevos publicos: ${newAudiences.slice(0, 3).join(', ')}`);
  }

  return parts.length > 0 ? parts.join(' · ') : 'Mantiene lineas similares a la estrategia previa.';
}

function parseSections(rawInput: string): StructuredSections {
  const lines = rawInput
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: StructuredSections = {
    month: parseMonth(rawInput) ?? undefined,
    monthlyBudget: null,
    ages: undefined,
    cities: [],
    audiences: [],
    exclusions: [],
    campaignNewLines: [],
    campaignOffLines: [],
    campaignOptimizeLines: [],
    creativeLines: [],
    driveLines: [],
    noteLines: [],
  };

  let currentSection: SectionBucket | null = null;

  for (const line of lines) {
    const normalized = normalizeText(line);
    const [head, ...restParts] = line.split(':');
    const rest = restParts.join(':').trim();

    if (/^(mes|month)/i.test(head)) {
      sections.month = parseMonth(rest || line) ?? sections.month;
      currentSection = null;
      continue;
    }

    if (/(presupuesto|budget|inversion)/i.test(normalized)) {
      const budget = parseMoneyToken(line);
      if (budget != null) sections.monthlyBudget = budget;
      currentSection = null;
      continue;
    }

    if (/^edades?/i.test(head) || /^edad/i.test(normalized)) {
      sections.ages = rest || line.replace(/edades?:?/i, '').trim();
      currentSection = null;
      continue;
    }

    if (/^ciudades?/i.test(head)) {
      sections.cities.push(...splitList(rest));
      currentSection = null;
      continue;
    }

    if (/^(publicos|audiencias?|segmentacion)/i.test(head) || /publico|audiencia/.test(normalized)) {
      sections.audiences.push(...splitList(rest || line.replace(/^[^:]+:/, '')));
      currentSection = null;
      continue;
    }

    if (/^exclusiones?/i.test(head) || /exclusi/.test(normalized)) {
      sections.exclusions.push(...splitList(rest || line.replace(/^[^:]+:/, '')));
      currentSection = null;
      continue;
    }

    if (/campa/.test(normalized) && /nueva|nuevas|crear|activar/.test(normalized)) {
      currentSection = 'campaignNewLines';
      if (rest) sections.campaignNewLines.push(...splitList(rest));
      continue;
    }

    if (/campa/.test(normalized) && /(apagar|off|pausar)/.test(normalized)) {
      currentSection = 'campaignOffLines';
      if (rest) sections.campaignOffLines.push(...splitList(rest));
      continue;
    }

    if (/campa/.test(normalized) && /optimiz|ajust|escalar/.test(normalized)) {
      currentSection = 'campaignOptimizeLines';
      if (rest) sections.campaignOptimizeLines.push(...splitList(rest));
      continue;
    }

    if (/^creativos?/i.test(head) || /creativo|video|carrusel|imagen/.test(normalized)) {
      currentSection = 'creativeLines';
      if (rest) sections.creativeLines.push(...splitList(rest));
      continue;
    }

    if (/drive|link|links|archivo/.test(normalized) && /https?:\/\//i.test(line)) {
      currentSection = 'driveLines';
      sections.driveLines.push(line);
      continue;
    }

    if (/^notas?/i.test(head) || /^observaciones?/i.test(head)) {
      currentSection = 'noteLines';
      if (rest) sections.noteLines.push(rest);
      continue;
    }

    if (currentSection) {
      sections[currentSection].push(line);
      continue;
    }

    sections.noteLines.push(line);
  }

  sections.cities = uniqueStrings(sections.cities);
  sections.audiences = uniqueStrings(sections.audiences);
  sections.exclusions = uniqueStrings(sections.exclusions);
  sections.noteLines = uniqueStrings(sections.noteLines);
  return sections;
}

export function buildChecklistFromStrategy(strategy: Strategy | StrategyInput): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  for (const campaign of strategy.campaigns_new) {
    items.push({
      task: `Crear campaña ${campaign.name}`,
      priority: 'high',
      notes: campaign.objective ? `Objetivo ${campaign.objective}` : campaign.notes,
      done: false,
    });
  }

  for (const campaign of strategy.campaigns_off) {
    items.push({
      task: `Apagar campaña ${campaign.name}`,
      priority: 'medium',
      notes: campaign.reason,
      done: false,
    });
  }

  for (const campaign of strategy.campaigns_optimize) {
    items.push({
      task: `Optimizar campaña ${campaign.name}`,
      priority: (campaign.priority as ChecklistItem['priority']) ?? 'medium',
      notes: campaign.action,
      done: false,
    });
  }

  if (strategy.segmentation.audiences?.length || strategy.segmentation.cities?.length) {
    items.push({
      task: 'Configurar segmentacion y publicos',
      priority: 'high',
      notes: [
        strategy.segmentation.ages,
        strategy.segmentation.cities?.join(', '),
        strategy.segmentation.audiences?.join(', '),
      ]
        .filter(Boolean)
        .join(' · '),
      done: false,
    });
  }

  if (strategy.creatives.length > 0) {
    items.push({
      task: 'Cargar y validar creativos',
      priority: 'high',
      notes: `${strategy.creatives.length} creativo(s) asociado(s)`,
      done: false,
    });
  }

  if (items.length === 0) {
    items.push({
      task: 'Revisar estructura base antes de montar',
      priority: 'medium',
      done: false,
    });
  }

  const uniqueTasks = new Set<string>();
  return items.filter((item) => {
    if (uniqueTasks.has(item.task)) return false;
    uniqueTasks.add(item.task);
    return true;
  });
}

export async function summarizePreviousStrategy(clientId: string): Promise<string> {
  const strategies = await listStrategies(clientId);
  const previous = strategies.find((strategy) => strategy.status === 'approved') ?? strategies[0] ?? null;

  if (!previous) {
    return 'No hay estrategia anterior registrada para este cliente.';
  }

  const audienceText = previous.segmentation.audiences?.length
    ? ` Publicos: ${previous.segmentation.audiences.slice(0, 3).join(', ')}.`
    : '';

  const budgetText = previous.monthly_budget != null
    ? ` Presupuesto ${Intl.NumberFormat('es-CO').format(previous.monthly_budget)}.`
    : '';

  const summaryBase =
    previous.ai_summary ??
    `Ultima estrategia ${previous.month?.slice(0, 7) ?? 'sin mes'} con ${previous.campaigns_new.length} campanas nuevas y ${previous.campaigns_off.length} campanas off.`;

  return `${summaryBase}${budgetText}${audienceText}`.trim();
}

export async function structureStrategyFromText(params: {
  clientId: string;
  rawInput: string;
}): Promise<StructuredStrategyResponse> {
  const client = await getClientByIdOrSlug(params.clientId);
  if (!client) {
    throw new Error('No se encontro el cliente para estructurar la estrategia.');
  }

  const [strategies, clientMemory] = await Promise.all([
    listStrategies(params.clientId),
    getClientMemory(params.clientId),
  ]);

  const previous = strategies.find((strategy) => strategy.status === 'approved') ?? strategies[0] ?? null;
  const sections = parseSections(params.rawInput);
  const title = detectTitle(params.rawInput, client);
  const month = sections.month ?? getCurrentMonthIso();
  const monthlyBudget =
    sections.monthlyBudget ??
    previous?.monthly_budget ??
    null;

  const strategy: StrategyInput = {
    client_id: client.id,
    title,
    month,
    status: 'pending',
    monthly_budget: monthlyBudget,
    responsible_id: null,
    created_by: null,
    campaigns_new: parseCampaignLines(sections.campaignNewLines, 'new'),
    campaigns_off: parseCampaignLines(sections.campaignOffLines, 'off'),
    campaigns_optimize: parseCampaignLines(sections.campaignOptimizeLines, 'optimize'),
    segmentation: {
      ages: sections.ages ?? previous?.segmentation.ages ?? undefined,
      cities: uniqueStrings([
        ...sections.cities,
        ...(client.target_cities ?? []),
        client.main_city ?? null,
      ]),
      audiences: uniqueStrings([
        ...sections.audiences,
        ...(((clientMemory?.historical_audiences ?? []) as Array<Record<string, unknown>>)
          .map((entry) => String(entry.name ?? '').trim())
          .filter(Boolean)
          .slice(0, 2)),
      ]),
      exclusions: sections.exclusions,
    },
    creatives: parseCreativeLines(sections.creativeLines),
    drive_links: extractDriveLinks(params.rawInput, sections.driveLines),
    notes: uniqueStrings(sections.noteLines).join(' | ') || null,
    ai_summary: null,
    ai_checklist: [],
    ai_diff: null,
    raw_input: params.rawInput,
    latest_version: 1,
  };

  const previousSummary = await summarizePreviousStrategy(client.id);
  strategy.ai_summary = [
    `Propuesta para ${client.name}`,
    monthlyBudget != null
      ? `presupuesto sugerido ${Intl.NumberFormat('es-CO').format(monthlyBudget)}`
      : null,
    strategy.campaigns_new.length > 0
      ? `${strategy.campaigns_new.length} campanas nuevas`
      : null,
    strategy.campaigns_optimize.length > 0
      ? `${strategy.campaigns_optimize.length} frentes de optimizacion`
      : null,
    strategy.segmentation.audiences?.length
      ? `publicos ${strategy.segmentation.audiences.slice(0, 3).join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  strategy.ai_checklist = buildChecklistFromStrategy(strategy);
  strategy.ai_diff = buildDiff(strategy, previous);

  const observations = uniqueStrings([
    previous ? 'Se uso la estrategia anterior como referencia operativa.' : 'No hay estrategia aprobada previa.',
    clientMemory?.learnings ? `Aprendizajes previos: ${clientMemory.learnings}` : null,
    strategy.campaigns_new.length === 0 ? 'No se detectaron campanas nuevas con claridad; revisar antes de guardar.' : null,
    strategy.creatives.length === 0 ? 'No se detectaron creativos claros en el texto; conviene validarlos.' : null,
  ]);

  return {
    strategy,
    observations,
    previousSummary,
  };
}

function pickEntriesByType(entries: MemoryEntry[], type: MemoryEntry['memory_type']): string[] {
  return uniqueStrings(entries.filter((entry) => entry.memory_type === type).map((entry) => entry.content));
}

export async function queryClientMemory(
  clientId: string,
  query: string,
): Promise<MemoryQueryResponse> {
  const normalizedQuery = normalizeText(query);
  const [memory, entries, strategies, previousSummary] = await Promise.all([
    getClientMemory(clientId),
    listMemoryEntries(clientId, 20),
    listStrategies(clientId),
    summarizePreviousStrategy(clientId),
  ]);

  const latestApproved = strategies.find((strategy) => strategy.status === 'approved') ?? strategies[0] ?? null;
  const audienceHighlights = uniqueStrings([
    ...(((memory?.historical_audiences ?? []) as Array<Record<string, unknown>>)
      .map((entry) => String(entry.name ?? '').trim())
      .filter(Boolean)),
    ...pickEntriesByType(entries, 'audience'),
    ...(latestApproved?.segmentation.audiences ?? []),
  ]).slice(0, 6);

  const learningHighlights = uniqueStrings([
    memory?.learnings ?? null,
    ...pickEntriesByType(entries, 'learning'),
  ]).slice(0, 4);

  if (/resumen|estrategia anterior|ultima estrategia/.test(normalizedQuery)) {
    return {
      answer: previousSummary,
      highlights: latestApproved?.campaigns_new.map((campaign) => campaign.name).slice(0, 4) ?? [],
    };
  }

  if (/publicos|audiencias|segmentacion/.test(normalizedQuery)) {
    return {
      answer:
        audienceHighlights.length > 0
          ? `Publicos mas usados: ${audienceHighlights.join(', ')}.`
          : 'No hay publicos historicos guardados para este cliente.',
      highlights: audienceHighlights,
    };
  }

  if (/aprendiz|learning|insight|aprendido/.test(normalizedQuery)) {
    return {
      answer:
        learningHighlights.length > 0
          ? `Aprendizajes activos: ${learningHighlights.join(' | ')}`
          : 'Todavia no hay aprendizajes consolidados en memoria para este cliente.',
      highlights: learningHighlights,
    };
  }

  if (/campan/.test(normalizedQuery) && /apag|off|activar|nueva/.test(normalizedQuery)) {
    const parts = [
      latestApproved?.campaigns_new.length
        ? `Nuevas: ${latestApproved.campaigns_new.map((campaign) => campaign.name).slice(0, 3).join(', ')}`
        : null,
      latestApproved?.campaigns_off.length
        ? `Off: ${latestApproved.campaigns_off.map((campaign) => campaign.name).slice(0, 3).join(', ')}`
        : null,
    ].filter((value): value is string => Boolean(value));

    return {
      answer: parts.length > 0 ? parts.join(' · ') : 'No hay cambios de campanas guardados en memoria.',
      highlights: parts,
    };
  }

  const genericHighlights = uniqueStrings([
    memory?.niche ?? null,
    ...(memory?.main_cities ?? []),
    ...(memory?.frequent_objectives ?? []),
    ...learningHighlights,
  ]).slice(0, 6);

  return {
    answer: [
      previousSummary,
      genericHighlights.length > 0 ? `Contexto clave: ${genericHighlights.join(' · ')}` : null,
    ]
      .filter(Boolean)
      .join(' '),
    highlights: genericHighlights,
  };
}
