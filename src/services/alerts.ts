import {
  getErrorMessage,
  isSupabaseConfigured,
  type OperationalIssue,
  SUPABASE_MISSING_MESSAGE,
  supabase,
  type Alert,
  type AlertSeverity,
  type AlertStatus,
  type ServiceMutationResult,
} from '../lib/supabase';
import { getAlertSnoozedUntil } from '../lib/utils';
import { logActivitySafe } from './activityLog';
import { isMissingRpcFunction, normalizeOptionalText } from './serviceHelpers';

type ListAlertsParams = {
  clientId?: string;
};

export async function listAlerts({ clientId }: ListAlertsParams = {}): Promise<Alert[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (clientId) query = query.eq('client_id', clientId);

  const { data, error } = await query;

  if (error) {
    console.error('[alerts] listAlerts', error);
    return [];
  }

  return (data ?? []) as Alert[];
}

function mergeAlertMetadata(
  base: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return {
    ...(base ?? {}),
    ...(patch ?? {}),
  };
}

function isFutureIsoDate(value?: string | null): boolean {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

export function buildRuleKey(parts: Array<string | number | null | undefined>): string {
  return parts
    .map((part) => String(part ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join(':')
    .replace(/\s+/g, '-');
}

export async function createOrTouchOperationalAlert(params: {
  clientId: string;
  type: string;
  ruleKey: string;
  title: string;
  body?: string | null;
  severity?: AlertSeverity;
  triggeredBy?: string;
  metadata?: Record<string, unknown>;
}): Promise<ServiceMutationResult<Alert>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const payload = {
    client_id: params.clientId,
    type: params.type,
    rule_key: buildRuleKey([params.ruleKey]),
    title: params.title.trim(),
    body: normalizeOptionalText(params.body),
    severity: params.severity ?? 'info',
    triggered_by: params.triggeredBy ?? 'system',
    metadata: params.metadata ?? {},
  };

  const { data: rpcData, error: rpcError } = await supabase.rpc('touch_operational_alert', {
    p_client_id: payload.client_id,
    p_type: payload.type,
    p_rule_key: payload.rule_key,
    p_title: payload.title,
    p_body: payload.body,
    p_severity: payload.severity,
    p_triggered_by: payload.triggered_by,
    p_metadata: payload.metadata,
  });

  if (!rpcError) {
    return { data: (rpcData ?? null) as Alert | null, error: null };
  }

  if (!isMissingRpcFunction(rpcError, 'touch_operational_alert')) {
    console.error('[alerts] createOrTouchOperationalAlert rpc', rpcError);
    return {
      data: null,
      error: getErrorMessage(rpcError, 'No se pudo guardar la alerta operativa.'),
    };
  }

  const { data: existing, error: existingError } = await supabase
    .from('alerts')
    .select('*')
    .eq('client_id', payload.client_id)
    .eq('rule_key', payload.rule_key)
    .in('status', ['unread', 'read'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error('[alerts] createOrTouchOperationalAlert existing', existingError);
    return {
      data: null,
      error: getErrorMessage(existingError, 'No se pudo validar alertas abiertas.'),
    };
  }

  if (existing) {
    const existingMetadata =
      existing.metadata && typeof existing.metadata === 'object'
        ? (existing.metadata as Record<string, unknown>)
        : {};
    const snoozedUntil = getAlertSnoozedUntil(existing);
    const keepSnoozed = isFutureIsoDate(snoozedUntil);
    const { data, error } = await supabase
      .from('alerts')
      .update({
        title: payload.title,
        body: payload.body,
        severity: payload.severity,
        triggered_by: payload.triggered_by,
        metadata: keepSnoozed
          ? mergeAlertMetadata(payload.metadata, {
              ...existingMetadata,
              snoozed_until: snoozedUntil,
            })
          : payload.metadata,
        status: keepSnoozed ? 'read' : 'unread',
        last_triggered_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[alerts] createOrTouchOperationalAlert update', error);
      return {
        data: null,
        error: getErrorMessage(error, 'No se pudo actualizar la alerta operativa.'),
      };
    }

    return { data: (data ?? null) as Alert | null, error: null };
  }

  const { data, error } = await supabase
    .from('alerts')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[alerts] createOrTouchOperationalAlert insert', error);
    return {
      data: null,
      error: getErrorMessage(error, 'No se pudo crear la alerta operativa.'),
    };
  }

  return { data: (data ?? null) as Alert | null, error: null };
}

export async function resolveOperationalAlert(
  clientId: string,
  ruleKey: string,
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  const { error } = await supabase
    .from('alerts')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    })
    .eq('client_id', clientId)
    .eq('rule_key', buildRuleKey([ruleKey]))
    .in('status', ['unread', 'read']);

  if (error) {
    console.error('[alerts] resolveOperationalAlert', error);
  }
}

function createIssueAlert(issue: OperationalIssue): Promise<ServiceMutationResult<Alert>> {
  return createOrTouchOperationalAlert({
    clientId: issue.client_id,
    type: issue.type,
    ruleKey: issue.rule_key,
    title: issue.title,
    body: issue.body,
    severity: issue.severity,
    triggeredBy: 'operational_checks',
    metadata: issue.metadata,
  });
}

export function createMissingSalesYesterdayAlert(issue: OperationalIssue) {
  return createIssueAlert(issue);
}

export function createOptimizeEvery5DaysAlert(issue: OperationalIssue) {
  return createIssueAlert(issue);
}

export function createCriticalOpenAlertsAlert(issue: OperationalIssue) {
  return createIssueAlert(issue);
}

export function createLowRealRoasAlert(issue: OperationalIssue) {
  return createIssueAlert(issue);
}

export function createOverdueTasksAlert(issue: OperationalIssue) {
  return createIssueAlert(issue);
}

export async function updateAlertStatus(
  id: string,
  status: AlertStatus,
): Promise<ServiceMutationResult<Alert>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const updates =
    status === 'resolved'
      ? { status, resolved_at: new Date().toISOString() }
      : { status, resolved_at: status === 'dismissed' ? null : undefined };

  const { data, error } = await supabase
    .from('alerts')
    .update(updates)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[alerts] updateAlertStatus', error);
    return { data: null, error: getErrorMessage(error, 'No se pudo actualizar la alerta.') };
  }

  if (data && (status === 'resolved' || status === 'dismissed')) {
    await logActivitySafe({
      client_id: (data as Alert).client_id ?? null,
      entity_type: 'alert',
      entity_id: (data as Alert).id,
      action: status === 'resolved' ? 'alert_resolved' : 'alert_dismissed',
      description: `${(data as Alert).title}.`,
      metadata: {
        rule_key: (data as Alert).rule_key,
        severity: (data as Alert).severity,
        status,
      },
    });
  }

  return { data: (data ?? null) as Alert | null, error: null };
}

export async function postponeAlert(
  id: string,
  snoozedUntil: string,
): Promise<ServiceMutationResult<Alert>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: SUPABASE_MISSING_MESSAGE };
  }

  const timestamp = new Date(snoozedUntil).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
    return { data: null, error: 'La fecha para posponer debe ser futura.' };
  }

  const { data: current, error: currentError } = await supabase
    .from('alerts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (currentError || !current) {
    console.error('[alerts] postponeAlert load', currentError);
    return {
      data: null,
      error: getErrorMessage(currentError, 'No se pudo cargar la alerta a posponer.'),
    };
  }

  const currentMetadata =
    current.metadata && typeof current.metadata === 'object'
      ? (current.metadata as Record<string, unknown>)
      : {};

  const { data, error } = await supabase
    .from('alerts')
    .update({
      status: 'read',
      resolved_at: null,
      metadata: mergeAlertMetadata(currentMetadata, {
        snoozed_until: new Date(snoozedUntil).toISOString(),
      }),
    })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[alerts] postponeAlert update', error);
    return { data: null, error: getErrorMessage(error, 'No se pudo posponer la alerta.') };
  }

  if (data) {
    await logActivitySafe({
      client_id: (data as Alert).client_id ?? null,
      entity_type: 'alert',
      entity_id: (data as Alert).id,
      action: 'alert_snoozed',
      description: `${(data as Alert).title}.`,
      metadata: {
        rule_key: (data as Alert).rule_key,
        severity: (data as Alert).severity,
        snoozed_until: new Date(snoozedUntil).toISOString(),
      },
    });
  }

  return { data: (data ?? null) as Alert | null, error: null };
}
