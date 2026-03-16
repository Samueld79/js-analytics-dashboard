import type {
  Alert,
  ChecklistItem,
  Client,
  ClientMemory,
  MemoryEntry,
  Strategy,
  StrategyInput,
} from '../lib/supabase';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  formatCop,
  formatNumber,
  formatRoas,
  isAlertSnoozed,
  sumOperatingKpis,
  sumSales,
} from '../lib/utils';
import { getMonthKey, getMonthLabel } from '../utils/monthLabel';
import { listAlerts } from './alerts';
import { getClientByIdOrSlug } from './clients';
import { listDailyOperatingKpis, listMonthlyOperatingKpis } from './dashboard';
import { listDailySales } from './dailySales';
import { getClientMemory, listMemoryEntries } from './memory';
import { listStrategies } from './strategies';

const aiStrategyFunctionName = (import.meta.env.VITE_AI_STRATEGY_FUNCTION ?? '').trim();

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

export type StrategyGenerationMode = 'edge_function' | 'local_context';

export type StrategyContextSnapshot = {
  month: string;
  monthLabel: string;
  monthlySpend: number;
  monthlyMessages: number;
  monthlySales: number;
  monthlyRealRoas: number;
  recentSalesTotal: number;
  recentSalesCount: number;
  activeAlerts: string[];
  previousStrategyTitle: string | null;
  previousSummary: string | null;
  memoryHighlights: string[];
  learningHighlights: string[];
  recentChanges: string[];
};

type StrategyContextData = {
  client: Client;
  clientMemory: ClientMemory | null;
  memoryEntries: MemoryEntry[];
  strategies: Strategy[];
  previous: Strategy | null;
  alerts: Alert[];
  snapshot: StrategyContextSnapshot;
};

export type StructuredStrategyResponse = {
  strategy: StrategyInput;
  observations: string[];
  previousSummary: string | null;
  generationMode: StrategyGenerationMode;
  contextSnapshot: StrategyContextSnapshot;
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

function normalizeMonthValue(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  return parseMonth(trimmed) ?? fallback;
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
      parts.push(
        `Presupuesto ${delta > 0 ? 'sube' : 'baja'} ${Intl.NumberFormat('es-CO').format(Math.abs(delta))}`,
      );
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

function pickEntriesByType(entries: MemoryEntry[], type: MemoryEntry['memory_type']): string[] {
  return uniqueStrings(entries.filter((entry) => entry.memory_type === type).map((entry) => entry.content));
}

function summarizeStrategyRecord(strategy: Strategy | null): string {
  if (!strategy) {
    return 'No hay estrategia anterior registrada para este cliente.';
  }

  const audienceText = strategy.segmentation.audiences?.length
    ? ` Publicos: ${strategy.segmentation.audiences.slice(0, 3).join(', ')}.`
    : '';

  const budgetText = strategy.monthly_budget != null
    ? ` Presupuesto ${Intl.NumberFormat('es-CO').format(strategy.monthly_budget)}.`
    : '';

  const summaryBase =
    strategy.ai_summary ??
    `Ultima estrategia ${strategy.month?.slice(0, 7) ?? 'sin mes'} con ${strategy.campaigns_new.length} campanas nuevas y ${strategy.campaigns_off.length} campanas off.`;

  return `${summaryBase}${budgetText}${audienceText}`.trim();
}

function appendChecklistItem(
  items: ChecklistItem[],
  item: ChecklistItem,
): void {
  if (!item.task.trim()) return;
  if (items.some((entry) => entry.task.trim().toLowerCase() === item.task.trim().toLowerCase())) {
    return;
  }
  items.push(item);
}

function getActiveAlerts(alerts: Alert[]): Alert[] {
  return alerts.filter(
    (alert) => ['unread', 'read'].includes(alert.status) && !isAlertSnoozed(alert),
  );
}

async function loadStrategyContext(params: {
  clientId: string;
  rawInput?: string;
}): Promise<StrategyContextData> {
  const client = await getClientByIdOrSlug(params.clientId);
  if (!client) {
    throw new Error('No se encontro el cliente para estructurar la estrategia.');
  }

  const selectedMonth = parseMonth(params.rawInput ?? '') ?? getCurrentMonthIso();
  const selectedMonthKey = getMonthKey(selectedMonth) ?? getCurrentMonthIso().slice(0, 7);
  const selectedMonthFloor = `${selectedMonthKey}-01`;

  const [strategies, clientMemory, memoryEntries, alerts, dailyKpis, monthlyKpis, recentSales] =
    await Promise.all([
      listStrategies(client.id),
      getClientMemory(client.id),
      listMemoryEntries(client.id, 30),
      listAlerts({ clientId: client.id }),
      listDailyOperatingKpis({ clientId: client.id, days: 21 }),
      listMonthlyOperatingKpis({ clientId: client.id, monthsBack: 6 }),
      listDailySales({ clientId: client.id, startDate: `${selectedMonthKey}-01` }),
    ]);

  const previous = strategies.find((strategy) => strategy.status === 'approved') ?? strategies[0] ?? null;
  const previousSummary = summarizeStrategyRecord(previous);
  const activeAlerts = getActiveAlerts(alerts);
  const selectedMonthlyRow =
    monthlyKpis.find((row) => getMonthKey(row.month) === selectedMonthKey) ?? null;
  const selectedMonthDailyRows = dailyKpis.filter(
    (row) => getMonthKey(row.date) === selectedMonthKey,
  );
  const selectedMonthSales = recentSales.filter(
    (row) => getMonthKey(row.date) === selectedMonthKey,
  );
  const operatingSnapshot = selectedMonthlyRow
    ? sumOperatingKpis([selectedMonthlyRow])
    : sumOperatingKpis(selectedMonthDailyRows);
  const salesSnapshot = sumSales(selectedMonthSales);

  const memoryHighlights = uniqueStrings([
    ...(clientMemory?.frequent_objectives ?? []),
    ...(clientMemory?.main_cities ?? []),
    ...pickEntriesByType(memoryEntries, 'summary'),
    ...pickEntriesByType(memoryEntries, 'audience'),
  ]).slice(0, 6);

  const learningHighlights = uniqueStrings([
    clientMemory?.learnings ?? null,
    ...pickEntriesByType(memoryEntries, 'learning'),
  ]).slice(0, 4);

  const recentChanges = uniqueStrings(
    memoryEntries
      .filter((entry) => ['strategy', 'manual', 'alert', 'task'].includes(entry.source_type))
      .map((entry) => entry.content)
      .slice(0, 5),
  );

  return {
    client,
    clientMemory,
    memoryEntries,
    strategies,
    previous,
    alerts,
    snapshot: {
      month: selectedMonthFloor,
      monthLabel: getMonthLabel(selectedMonthKey),
      monthlySpend: operatingSnapshot.spend,
      monthlyMessages: operatingSnapshot.messages,
      monthlySales: operatingSnapshot.total_sales || salesSnapshot.total,
      monthlyRealRoas: operatingSnapshot.real_roas,
      recentSalesTotal: salesSnapshot.total,
      recentSalesCount: selectedMonthSales.length,
      activeAlerts: activeAlerts.map((alert) => alert.title).slice(0, 5),
      previousStrategyTitle: previous?.title ?? null,
      previousSummary,
      memoryHighlights,
      learningHighlights,
      recentChanges,
    },
  };
}

export async function getStrategyContextPreview(clientId: string): Promise<StrategyContextSnapshot> {
  const context = await loadStrategyContext({ clientId });
  return context.snapshot;
}

function buildSummaryFromContext(params: {
  client: Client;
  snapshot: StrategyContextSnapshot;
  strategy: StrategyInput;
  monthlyBudget: number | null;
}): string {
  return [
    `Plan de ${params.client.name} para ${params.snapshot.monthLabel}.`,
    params.monthlyBudget != null
      ? `Presupuesto mensual sugerido ${formatCop(params.monthlyBudget)}.`
      : null,
    params.snapshot.monthlySpend > 0
      ? `Referencia operativa disponible: ${formatCop(params.snapshot.monthlySpend)} en Ads, ${formatNumber(params.snapshot.monthlyMessages)} mensajes y ROAS real ${formatRoas(params.snapshot.monthlyRealRoas)}.`
      : 'No hay cierre operativo completo del mes; se usa historial reciente y memoria del cliente.',
    params.snapshot.monthlySales > 0
      ? `Ventas reportadas del mes: ${formatCop(params.snapshot.monthlySales)}.`
      : null,
    params.strategy.campaigns_new.length > 0
      ? `Se priorizan ${params.strategy.campaigns_new.length} campaña(s) nueva(s).`
      : null,
    params.strategy.campaigns_optimize.length > 0
      ? `${params.strategy.campaigns_optimize.length} frente(s) requieren optimización.`
      : null,
    params.snapshot.activeAlerts.length > 0
      ? `Alertas activas a considerar: ${params.snapshot.activeAlerts.slice(0, 2).join(', ')}.`
      : null,
  ]
    .filter(Boolean)
    .join(' ');
}

function buildLocalStrategy(params: {
  rawInput: string;
  context: StrategyContextData;
}): StructuredStrategyResponse {
  const { client, clientMemory, previous, snapshot } = params.context;
  const sections = parseSections(params.rawInput);
  const title = detectTitle(params.rawInput, client);
  const month = sections.month ?? snapshot.month;
  const monthlyBudget = sections.monthlyBudget ?? previous?.monthly_budget ?? null;

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
          .slice(0, 3)),
        ...(previous?.segmentation.audiences ?? []).slice(0, 3),
      ]),
      exclusions: sections.exclusions,
    },
    creatives: parseCreativeLines(sections.creativeLines),
    drive_links: extractDriveLinks(params.rawInput, sections.driveLines),
    notes: uniqueStrings([
      ...sections.noteLines,
      clientMemory?.recurring_notes ?? null,
    ]).join(' | ') || null,
    ai_summary: null,
    ai_checklist: [],
    ai_diff: null,
    raw_input: params.rawInput,
    latest_version: 1,
  };

  strategy.ai_summary = buildSummaryFromContext({
    client,
    snapshot,
    strategy,
    monthlyBudget,
  });
  strategy.ai_checklist = buildChecklistFromStrategy(strategy);
  strategy.ai_diff = buildDiff(strategy, previous);

  appendChecklistItem(strategy.ai_checklist, {
    task: 'Validar presupuesto y objetivo del mes antes de montar',
    priority: 'high',
    notes: snapshot.monthLabel,
    done: false,
  });

  if (snapshot.activeAlerts.length > 0) {
    appendChecklistItem(strategy.ai_checklist, {
      task: 'Revisar alertas activas antes de aprobar la estrategia',
      priority: 'high',
      notes: snapshot.activeAlerts.slice(0, 2).join(' · '),
      done: false,
    });
  }

  if (snapshot.recentSalesCount === 0) {
    appendChecklistItem(strategy.ai_checklist, {
      task: 'Confirmar ventas reportadas del mes con el cliente',
      priority: 'medium',
      notes: 'No hay registros de ventas visibles para el mes seleccionado.',
      done: false,
    });
  }

  if (strategy.creatives.length === 0) {
    appendChecklistItem(strategy.ai_checklist, {
      task: 'Pedir piezas creativas y rutas de Drive',
      priority: 'medium',
      notes: 'El brief no incluyó creativos claros.',
      done: false,
    });
  }

  const observations = uniqueStrings([
    previous
      ? 'Se uso la estrategia anterior como referencia operativa.'
      : 'No hay estrategia aprobada previa.',
    snapshot.previousSummary ? `Base anterior: ${snapshot.previousSummary}` : null,
    snapshot.learningHighlights[0]
      ? `Aprendizaje clave: ${snapshot.learningHighlights[0]}`
      : null,
    snapshot.activeAlerts.length > 0
      ? `Alertas abiertas: ${snapshot.activeAlerts.slice(0, 3).join(' · ')}`
      : null,
    snapshot.recentChanges.length > 0
      ? `Cambios recientes: ${snapshot.recentChanges.slice(0, 2).join(' · ')}`
      : null,
    snapshot.monthlySpend > 0
      ? `Contexto del periodo: ${formatCop(snapshot.monthlySpend)} en Ads, ${formatNumber(snapshot.monthlyMessages)} mensajes y ${formatCop(snapshot.monthlySales)} en ventas reportadas.`
      : 'No se detecto cierre mensual consolidado para este periodo; revisar el brief antes de aprobar.',
    strategy.campaigns_new.length === 0
      ? 'No se detectaron campanas nuevas con claridad; revisar antes de guardar.'
      : null,
    strategy.creatives.length === 0
      ? 'No se detectaron creativos claros en el texto; conviene validarlos.'
      : null,
  ]);

  return {
    strategy,
    observations,
    previousSummary: snapshot.previousSummary,
    generationMode: 'local_context',
    contextSnapshot: snapshot,
  };
}

function normalizeCampaignArray(value: unknown): StrategyInput['campaigns_new'] | null {
  if (!Array.isArray(value)) return null;

  return value.reduce<StrategyInput['campaigns_new']>((items, entry) => {
      if (!entry || typeof entry !== 'object') return items;
      const item = entry as Record<string, unknown>;
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      if (!name) return items;

      items.push({
        name,
        objective: typeof item.objective === 'string' ? item.objective.trim() : undefined,
        budget: typeof item.budget === 'number' && Number.isFinite(item.budget) ? item.budget : undefined,
        audience: typeof item.audience === 'string' ? item.audience.trim() : undefined,
        notes: typeof item.notes === 'string' ? item.notes.trim() : undefined,
        reason: typeof item.reason === 'string' ? item.reason.trim() : undefined,
        action: typeof item.action === 'string' ? item.action.trim() : undefined,
        priority: typeof item.priority === 'string' ? item.priority.trim() : undefined,
      });

      return items;
    }, []);
}

function normalizeChecklist(value: unknown): ChecklistItem[] | null {
  if (!Array.isArray(value)) return null;

  return value.reduce<ChecklistItem[]>((items, entry) => {
      if (!entry || typeof entry !== 'object') return items;
      const item = entry as Record<string, unknown>;
      const task = typeof item.task === 'string' ? item.task.trim() : '';
      if (!task) return items;

      items.push({
        task,
        priority: typeof item.priority === 'string' ? item.priority.trim() : undefined,
        notes: typeof item.notes === 'string' ? item.notes.trim() : undefined,
        done: Boolean(item.done),
      });

      return items;
    }, []);
}

function normalizeSegmentation(
  fallback: StrategyInput['segmentation'],
  value: unknown,
): StrategyInput['segmentation'] {
  if (!value || typeof value !== 'object') return fallback;

  const item = value as Record<string, unknown>;
  const cities = Array.isArray(item.cities)
    ? item.cities.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim())
    : fallback.cities;
  const audiences = Array.isArray(item.audiences)
    ? item.audiences.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim())
    : fallback.audiences;
  const exclusions = Array.isArray(item.exclusions)
    ? item.exclusions.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim())
    : fallback.exclusions;

  return {
    ages: typeof item.ages === 'string' ? item.ages.trim() : fallback.ages,
    cities: uniqueStrings(cities ?? []),
    audiences: uniqueStrings(audiences ?? []),
    exclusions: uniqueStrings(exclusions ?? []),
  };
}

function normalizeCreatives(
  fallback: StrategyInput['creatives'],
  value: unknown,
): StrategyInput['creatives'] {
  if (!Array.isArray(value)) return fallback;

  const items = value.reduce<StrategyInput['creatives']>((accumulator, entry) => {
      if (!entry || typeof entry !== 'object') return accumulator;
      const item = entry as Record<string, unknown>;
      const type = typeof item.type === 'string' ? item.type.trim() : undefined;
      const description = typeof item.description === 'string' ? item.description.trim() : undefined;
      const link = typeof item.link === 'string' ? item.link.trim() : undefined;
      if (!type && !description && !link) return accumulator;
      accumulator.push({ type, description, link });
      return accumulator;
    }, []);

  return items.length > 0 ? items : fallback;
}

function normalizeDriveLinks(
  fallback: StrategyInput['drive_links'],
  value: unknown,
): StrategyInput['drive_links'] {
  if (!Array.isArray(value)) return fallback;

  const items = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Record<string, unknown>;
      const label = typeof item.label === 'string' ? item.label.trim() : '';
      const url = typeof item.url === 'string' ? item.url.trim() : '';
      if (!label || !url) return null;
      return { label, url };
    })
    .filter((entry): entry is StrategyInput['drive_links'][number] => Boolean(entry));

  return items.length > 0 ? items : fallback;
}

function mergeEdgeStrategy(
  fallback: StructuredStrategyResponse,
  rawResult: unknown,
): StructuredStrategyResponse | null {
  if (!rawResult || typeof rawResult !== 'object') return null;

  const payload = rawResult as Record<string, unknown>;
  const strategyPatch =
    payload.strategy && typeof payload.strategy === 'object'
      ? (payload.strategy as Record<string, unknown>)
      : null;

  if (!strategyPatch) return null;

  const campaignsNew = normalizeCampaignArray(strategyPatch.campaigns_new);
  const campaignsOff = normalizeCampaignArray(strategyPatch.campaigns_off);
  const campaignsOptimize = normalizeCampaignArray(strategyPatch.campaigns_optimize);
  const checklist = normalizeChecklist(strategyPatch.ai_checklist);
  const observations = Array.isArray(payload.observations)
    ? uniqueStrings(
        payload.observations.filter((entry): entry is string => typeof entry === 'string'),
      )
    : fallback.observations;

  return {
    ...fallback,
    strategy: {
      ...fallback.strategy,
      title:
        typeof strategyPatch.title === 'string' && strategyPatch.title.trim()
          ? strategyPatch.title.trim()
          : fallback.strategy.title,
      month: normalizeMonthValue(strategyPatch.month, fallback.strategy.month ?? fallback.contextSnapshot.month),
      monthly_budget:
        typeof strategyPatch.monthly_budget === 'number' && Number.isFinite(strategyPatch.monthly_budget)
          ? strategyPatch.monthly_budget
          : fallback.strategy.monthly_budget,
      notes:
        typeof strategyPatch.notes === 'string'
          ? strategyPatch.notes.trim() || null
          : fallback.strategy.notes,
      ai_summary:
        typeof strategyPatch.ai_summary === 'string'
          ? strategyPatch.ai_summary.trim() || null
          : fallback.strategy.ai_summary,
      ai_diff:
        typeof strategyPatch.ai_diff === 'string'
          ? strategyPatch.ai_diff.trim() || null
          : fallback.strategy.ai_diff,
      campaigns_new: campaignsNew ?? fallback.strategy.campaigns_new,
      campaigns_off: campaignsOff ?? fallback.strategy.campaigns_off,
      campaigns_optimize: campaignsOptimize ?? fallback.strategy.campaigns_optimize,
      segmentation: normalizeSegmentation(fallback.strategy.segmentation, strategyPatch.segmentation),
      creatives: normalizeCreatives(fallback.strategy.creatives, strategyPatch.creatives),
      drive_links: normalizeDriveLinks(fallback.strategy.drive_links, strategyPatch.drive_links),
      ai_checklist: checklist ?? fallback.strategy.ai_checklist,
    },
    observations,
    previousSummary:
      typeof payload.previousSummary === 'string'
        ? payload.previousSummary
        : fallback.previousSummary,
    generationMode: 'edge_function',
  };
}

async function tryInvokeEdgeStrategy(params: {
  clientId: string;
  rawInput: string;
  context: StrategyContextSnapshot;
  fallback: StructuredStrategyResponse;
}): Promise<StructuredStrategyResponse | null> {
  if (!aiStrategyFunctionName || !isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase.functions.invoke(aiStrategyFunctionName, {
      body: {
        clientId: params.clientId,
        rawInput: params.rawInput,
        context: params.context,
      },
    });

    if (error) {
      console.info('[ai] ai-structure-strategy fallback', error);
      return null;
    }

    return mergeEdgeStrategy(params.fallback, data);
  } catch (error) {
    console.info('[ai] ai-structure-strategy unavailable, using local context', error);
    return null;
  }
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
  return summarizeStrategyRecord(previous);
}

export async function structureStrategyFromText(params: {
  clientId: string;
  rawInput: string;
}): Promise<StructuredStrategyResponse> {
  const context = await loadStrategyContext(params);
  const fallback = buildLocalStrategy({
    rawInput: params.rawInput,
    context,
  });

  const edgeResult = await tryInvokeEdgeStrategy({
    clientId: params.clientId,
    rawInput: params.rawInput,
    context: context.snapshot,
    fallback,
  });

  return edgeResult ?? fallback;
}

export async function queryClientMemory(
  clientId: string,
  query: string,
): Promise<MemoryQueryResponse> {
  const normalizedQuery = normalizeText(query);
  const context = await loadStrategyContext({ clientId });
  const latestApproved =
    context.strategies.find((strategy) => strategy.status === 'approved') ??
    context.strategies[0] ??
    null;
  const audienceHighlights = uniqueStrings([
    ...(((context.clientMemory?.historical_audiences ?? []) as Array<Record<string, unknown>>)
      .map((entry) => String(entry.name ?? '').trim())
      .filter(Boolean)),
    ...pickEntriesByType(context.memoryEntries, 'audience'),
    ...(latestApproved?.segmentation.audiences ?? []),
  ]).slice(0, 6);

  const learningHighlights = uniqueStrings([
    context.clientMemory?.learnings ?? null,
    ...pickEntriesByType(context.memoryEntries, 'learning'),
  ]).slice(0, 4);

  if (
    context.strategies.length === 0 &&
    context.memoryEntries.length === 0 &&
    !context.clientMemory?.learnings
  ) {
    return {
      answer:
        'Todavia no hay memoria consolidada para este cliente. Guarda estrategias aprobadas, aprendizajes o notas para poder consultarlas aqui.',
      highlights: [],
    };
  }

  if (/resumen|estrategia anterior|ultima estrategia/.test(normalizedQuery)) {
    return {
      answer: context.snapshot.previousSummary ?? 'No hay estrategia anterior registrada.',
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

  if (/campan/.test(normalizedQuery) && /apag|off/.test(normalizedQuery)) {
    const campaignsOff = latestApproved?.campaigns_off.map((campaign) => campaign.name).slice(0, 5) ?? [];
    return {
      answer:
        campaignsOff.length > 0
          ? `Campanas apagadas registradas: ${campaignsOff.join(', ')}.`
          : 'No hay campanas apagadas guardadas en memoria.',
      highlights: campaignsOff,
    };
  }

  if (/campan/.test(normalizedQuery) && /cambi|reciente|nuevo|optimiz/.test(normalizedQuery)) {
    const changes = uniqueStrings([
      ...context.snapshot.recentChanges,
      ...(latestApproved?.campaigns_new.map((campaign) => `Nueva: ${campaign.name}`) ?? []),
      ...(latestApproved?.campaigns_optimize.map((campaign) => `Optimizar: ${campaign.name}`) ?? []),
    ]).slice(0, 5);

    return {
      answer:
        changes.length > 0
          ? `Cambios recientes identificados: ${changes.join(' | ')}`
          : 'No hay cambios recientes registrados para este cliente.',
      highlights: changes,
    };
  }

  const genericHighlights = uniqueStrings([
    context.clientMemory?.niche ?? null,
    ...(context.clientMemory?.main_cities ?? []),
    ...context.snapshot.memoryHighlights,
    ...learningHighlights,
  ]).slice(0, 6);

  return {
    answer: [
      context.snapshot.previousSummary,
      genericHighlights.length > 0 ? `Contexto clave: ${genericHighlights.join(' · ')}` : null,
      context.snapshot.activeAlerts.length > 0
        ? `Alertas abiertas: ${context.snapshot.activeAlerts.slice(0, 2).join(' · ')}`
        : null,
    ]
      .filter(Boolean)
      .join(' '),
    highlights: genericHighlights,
  };
}
