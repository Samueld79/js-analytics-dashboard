import { useEffect, useRef, useState } from 'react';
import { listBillingIssuers, upsertBillingIssuer } from '../services/billing';
import type { BillingInvoiceIssuerKey, BillingIssuer, BillingIssuerInput } from '../lib/supabase';

type FieldKey = 'legal_name' | 'nit' | 'email' | 'phone' | 'address' | 'bank_name' | 'account_type' | 'account_number' | 'brand_label';

const FIELD_LABELS: Record<FieldKey, string> = {
  legal_name: 'Nombre / razón social',
  nit: 'NIT',
  email: 'Correo',
  phone: 'Teléfono / contacto',
  address: 'Dirección',
  bank_name: 'Banco',
  account_type: 'Tipo de cuenta',
  account_number: 'Número de cuenta',
  brand_label: 'Etiqueta de marca',
};

const FIELD_ORDER: FieldKey[] = ['legal_name', 'nit', 'email', 'phone', 'address', 'bank_name', 'account_type', 'account_number', 'brand_label'];

const ISSUER_KEYS: BillingInvoiceIssuerKey[] = ['samuel', 'juanca'];
const ISSUER_LABELS: Record<BillingInvoiceIssuerKey, string> = { samuel: 'Samuel', juanca: 'Juanca' };

type RowSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type Draft = Record<FieldKey, string>;

function toDraft(issuer: BillingIssuer | undefined): Draft {
  return {
    legal_name: issuer?.legal_name ?? '',
    nit: issuer?.nit ?? '',
    email: issuer?.email ?? '',
    phone: issuer?.phone ?? '',
    address: issuer?.address ?? '',
    bank_name: issuer?.bank_name ?? '',
    account_type: issuer?.account_type ?? '',
    account_number: issuer?.account_number ?? '',
    brand_label: issuer?.brand_label ?? '',
  };
}

// Solo admin (ver RequireAgencyAdmin en App.tsx). Datos personales de
// Samuel/Juanca — este repo es público, así que NUNCA se hardcodea nada de
// esto en el código: todo viene de billing_issuers vía RLS admin-only.
export function BillingIssuersPage() {
  const [issuersByKey, setIssuersByKey] = useState<Map<BillingInvoiceIssuerKey, BillingIssuer>>(new Map());
  const [drafts, setDrafts] = useState<Map<BillingInvoiceIssuerKey, Draft>>(new Map());
  const [loading, setLoading] = useState(true);
  const [status, setStatusState] = useState<Map<BillingInvoiceIssuerKey, RowSaveStatus>>(new Map());
  const [errorByKey, setErrorByKey] = useState<Map<BillingInvoiceIssuerKey, string>>(new Map());

  const dirtyFieldsRef = useRef<Map<BillingInvoiceIssuerKey, Set<FieldKey>>>(new Map());
  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const statusHideTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingPatchRef = useRef<Map<BillingInvoiceIssuerKey, Partial<BillingIssuerInput>>>(new Map());
  const inFlightRef = useRef<Set<BillingInvoiceIssuerKey>>(new Set());
  const retryRef = useRef<Map<BillingInvoiceIssuerKey, () => void>>(new Map());

  useEffect(() => {
    const debounceTimers = debounceTimersRef.current;
    const statusHideTimers = statusHideTimersRef.current;

    (async () => {
      setLoading(true);
      const list = await listBillingIssuers();
      const map = new Map(list.map((i) => [i.key, i]));
      setIssuersByKey(map);
      setDrafts(
        new Map(
          ISSUER_KEYS.map((key) => [key, toDraft(map.get(key))]),
        ),
      );
      setLoading(false);
    })();

    return () => {
      for (const t of debounceTimers.values()) clearTimeout(t);
      for (const t of statusHideTimers.values()) clearTimeout(t);
    };
  }, []);

  function setStatus(key: BillingInvoiceIssuerKey, next: RowSaveStatus) {
    setStatusState((current) => new Map(current).set(key, next));
    const existingTimer = statusHideTimersRef.current.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      statusHideTimersRef.current.delete(key);
    }
    if (next === 'saved') {
      const timer = setTimeout(() => {
        setStatusState((current) => {
          if (current.get(key) !== 'saved') return current;
          const copy = new Map(current);
          copy.set(key, 'idle');
          return copy;
        });
        statusHideTimersRef.current.delete(key);
      }, 2000);
      statusHideTimersRef.current.set(key, timer);
    }
  }

  function setFieldError(key: BillingInvoiceIssuerKey, message: string | null) {
    setErrorByKey((current) => {
      const next = new Map(current);
      if (message) next.set(key, message);
      else next.delete(key);
      return next;
    });
  }

  async function savePatch(key: BillingInvoiceIssuerKey, patch: Partial<BillingIssuerInput>) {
    const merged = { ...(pendingPatchRef.current.get(key) ?? {}), ...patch };
    pendingPatchRef.current.set(key, merged);
    if (inFlightRef.current.has(key)) return;

    inFlightRef.current.add(key);
    setStatus(key, 'saving');
    setFieldError(key, null);

    let hadError = false;
    let savedFields: Partial<BillingIssuerInput> = {};

    while (pendingPatchRef.current.has(key)) {
      const toSend = pendingPatchRef.current.get(key)!;
      pendingPatchRef.current.delete(key);
      savedFields = toSend;

      const result = await upsertBillingIssuer({ key, ...toSend });
      if (result.error) {
        hadError = true;
        setFieldError(key, result.error);
        pendingPatchRef.current.set(key, { ...toSend, ...(pendingPatchRef.current.get(key) ?? {}) });
        break;
      }

      if (result.data) {
        setIssuersByKey((current) => new Map(current).set(key, result.data as BillingIssuer));
      }
    }

    if (!hadError) {
      const dirty = dirtyFieldsRef.current.get(key);
      if (dirty) {
        for (const field of Object.keys(savedFields) as FieldKey[]) dirty.delete(field);
      }
    }

    inFlightRef.current.delete(key);
    setStatus(key, hadError ? 'error' : 'saved');
    if (hadError) retryRef.current.set(key, () => void savePatch(key, {}));
    else retryRef.current.delete(key);
  }

  function updateDraft(key: BillingInvoiceIssuerKey, field: FieldKey, value: string) {
    const dirty = dirtyFieldsRef.current.get(key) ?? new Set<FieldKey>();
    dirty.add(field);
    dirtyFieldsRef.current.set(key, dirty);

    setDrafts((current) => {
      const next = new Map(current);
      const draft = next.get(key) ?? toDraft(issuersByKey.get(key));
      next.set(key, { ...draft, [field]: value });
      return next;
    });

    const timerKey = `${key}:${field}`;
    const existing = debounceTimersRef.current.get(timerKey);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      debounceTimersRef.current.delete(timerKey);
      commitField(key, field, value);
    }, 800);
    debounceTimersRef.current.set(timerKey, timer);
  }

  function handleBlur(key: BillingInvoiceIssuerKey, field: FieldKey, value: string) {
    const timerKey = `${key}:${field}`;
    const existing = debounceTimersRef.current.get(timerKey);
    if (existing) {
      clearTimeout(existing);
      debounceTimersRef.current.delete(timerKey);
    }
    commitField(key, field, value);
  }

  function commitField(key: BillingInvoiceIssuerKey, field: FieldKey, value: string) {
    const trimmed = value.trim();
    const committed = issuersByKey.get(key)?.[field] ?? '';
    if (trimmed === committed) return;
    void savePatch(key, { [field]: trimmed || null });
    const dirty = dirtyFieldsRef.current.get(key);
    dirty?.delete(field);
  }

  if (loading) {
    return (
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Datos de emisores</h1>
        </div>
        <p className="empty-note" style={{ padding: '0 24px' }}>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Datos de emisores</h1>
          <p className="page-subtitle">Datos de Samuel y Juanca para las cuentas de cobro · solo admin · guardado automático</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, padding: '0 24px 24px' }}>
        {ISSUER_KEYS.map((key) => {
          const issuer = issuersByKey.get(key);
          const draft = drafts.get(key) ?? toDraft(issuer);
          const rowStatus = status.get(key) ?? 'idle';
          const rowError = errorByKey.get(key);

          return (
            <div key={key} className="card-glass card-padded">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <h2 className="number-label" style={{ fontSize: '0.82rem', color: 'var(--fg)' }}>{ISSUER_LABELS[key]}</h2>
                {rowStatus === 'saving' && <span style={{ fontSize: '0.64rem', color: 'var(--fg-muted)', fontFamily: 'JetBrains Mono' }}>Guardando…</span>}
                {rowStatus === 'saved' && <span style={{ fontSize: '0.64rem', color: 'var(--success)', fontFamily: 'JetBrains Mono' }}>Guardado ✓</span>}
              </div>
              <p style={{ fontSize: '0.62rem', color: 'var(--fg-muted)', marginBottom: 12 }}>
                Próximo número de cuenta de cobro: #{String(issuer?.next_invoice_number ?? 1).padStart(5, '0')} (lo asigna el sistema, no editable aquí)
              </p>

              {FIELD_ORDER.map((field) => (
                <div className="form-field" key={field} style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: '0.64rem' }}>{FIELD_LABELS[field]}</label>
                  <input
                    className="form-input"
                    type="text"
                    value={draft[field]}
                    onChange={(e) => updateDraft(key, field, e.target.value)}
                    onBlur={(e) => handleBlur(key, field, e.target.value)}
                  />
                </div>
              ))}

              {rowStatus === 'error' && rowError && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                  <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--danger)' }}>{rowError}</p>
                  <button className="btn-secondary" onClick={() => retryRef.current.get(key)?.()}>
                    Reintentar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
