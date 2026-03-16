import { useMemo, useState } from 'react';
import type {
  AdMetric,
  DailySale,
  HistoricalMonthlyAdMetricInput,
  HistoricalMonthlySaleInput,
  ServiceMutationResult,
  SocialMonthlyMetric,
  SocialMonthlyMetricInput,
} from '../lib/supabase';
import { getMonthLabel } from '../utils/monthLabel';
import { validateDailySale } from '../lib/utils';

type HistoricalAdsInput = Omit<HistoricalMonthlyAdMetricInput, 'client_id'>;
type HistoricalSalesInput = Omit<HistoricalMonthlySaleInput, 'client_id'>;
type HistoricalSocialInput = Omit<SocialMonthlyMetricInput, 'client_id'>;

interface Props {
  clientName: string;
  onClose: () => void;
  onSaveAds: (input: HistoricalAdsInput) => Promise<ServiceMutationResult<AdMetric>>;
  onSaveSales: (input: HistoricalSalesInput) => Promise<ServiceMutationResult<DailySale>>;
  onSaveSocial: (input: HistoricalSocialInput) => Promise<ServiceMutationResult<SocialMonthlyMetric>>;
}

function parseDecimal(value: string): number {
  return Number.parseFloat(value) || 0;
}

export function HistoricalMonthlyModal({
  clientName,
  onClose,
  onSaveAds,
  onSaveSales,
  onSaveSocial,
}: Props) {
  const defaultMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(defaultMonth);
  const [savingAds, setSavingAds] = useState(false);
  const [savingSales, setSavingSales] = useState(false);
  const [savingSocial, setSavingSocial] = useState(false);
  const [adsError, setAdsError] = useState('');
  const [salesError, setSalesError] = useState('');
  const [socialError, setSocialError] = useState('');
  const [adsSuccess, setAdsSuccess] = useState('');
  const [salesSuccess, setSalesSuccess] = useState('');
  const [socialSuccess, setSocialSuccess] = useState('');
  const [adsForm, setAdsForm] = useState({
    spend: '',
    reach: '',
    impressions: '',
    clicks: '',
    messages: '',
    leads: '',
    purchases: '',
    purchase_value: '',
    cpm: '',
    cpc: '',
    ctr: '',
    roas: '',
    cpr: '',
    cpl: '',
    cpa: '',
    frequency: '',
  });
  const [salesForm, setSalesForm] = useState({
    total_sales: '',
    new_client_sales: '',
    repeat_sales: '',
    physical_store_sales: '',
    online_sales: '',
    observations: '',
  });
  const [socialForm, setSocialForm] = useState({
    new_followers: '',
    profile_visits: '',
    source: 'manual_monthly_followers',
    notes: '',
  });

  const adsValues = useMemo(
    () => ({
      spend: parseDecimal(adsForm.spend),
      reach: parseDecimal(adsForm.reach),
      impressions: parseDecimal(adsForm.impressions),
      clicks: parseDecimal(adsForm.clicks),
      messages: parseDecimal(adsForm.messages),
      leads: parseDecimal(adsForm.leads),
      purchases: parseDecimal(adsForm.purchases),
      purchase_value: parseDecimal(adsForm.purchase_value),
      cpm: parseDecimal(adsForm.cpm),
      cpc: parseDecimal(adsForm.cpc),
      ctr: parseDecimal(adsForm.ctr),
      roas: parseDecimal(adsForm.roas),
      cpr: parseDecimal(adsForm.cpr),
      cpl: parseDecimal(adsForm.cpl),
      cpa: parseDecimal(adsForm.cpa),
      frequency: adsForm.frequency ? parseDecimal(adsForm.frequency) : null,
    }),
    [adsForm],
  );

  const salesValues = useMemo(
    () => ({
      total_sales: parseDecimal(salesForm.total_sales),
      new_client_sales: parseDecimal(salesForm.new_client_sales),
      repeat_sales: parseDecimal(salesForm.repeat_sales),
      physical_store_sales: parseDecimal(salesForm.physical_store_sales),
      online_sales: parseDecimal(salesForm.online_sales),
    }),
    [salesForm],
  );

  const salesValidation = useMemo(() => validateDailySale(salesValues), [salesValues]);
  const canSaveAds = useMemo(
    () => Boolean(month && Object.values(adsValues).some((value) => (value ?? 0) > 0)),
    [adsValues, month],
  );
  const canSaveSales = useMemo(() => Boolean(month && salesValues.total_sales > 0), [month, salesValues.total_sales]);
  const canSaveSocial = useMemo(
    () =>
      Boolean(
        month &&
          (socialForm.new_followers.trim() !== '' || socialForm.profile_visits.trim() !== ''),
      ),
    [month, socialForm.new_followers, socialForm.profile_visits],
  );

  function setAdsField(field: keyof typeof adsForm, value: string) {
    setAdsSuccess('');
    setAdsError('');
    setAdsForm((current) => ({ ...current, [field]: value }));
  }

  function setSalesField(field: keyof typeof salesForm, value: string) {
    setSalesSuccess('');
    setSalesError('');
    setSalesForm((current) => ({ ...current, [field]: value }));
  }

  function setSocialField(field: keyof typeof socialForm, value: string) {
    setSocialSuccess('');
    setSocialError('');
    setSocialForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSaveAds() {
    if (!canSaveAds) return;

    setSavingAds(true);
    setAdsError('');
    setAdsSuccess('');

    const result = await onSaveAds({
      month,
      ...adsValues,
      source: 'manual_monthly_history',
    });

    if (result.error) {
      setAdsError(result.error);
      setSavingAds(false);
      return;
    }

    setAdsSuccess(`Histórico Ads guardado para ${getMonthLabel(`${month}-01`)}.`);
    setSavingAds(false);
  }

  async function handleSaveSales() {
    if (!canSaveSales) return;

    setSavingSales(true);
    setSalesError('');
    setSalesSuccess('');

    const result = await onSaveSales({
      month,
      ...salesValues,
      observations: salesForm.observations.trim() || null,
    });

    if (result.error) {
      setSalesError(result.error);
      setSavingSales(false);
      return;
    }

    setSalesSuccess(`Histórico de ventas guardado para ${getMonthLabel(`${month}-01`)}.`);
    setSavingSales(false);
  }

  async function handleSaveSocial() {
    if (!canSaveSocial) return;

    setSavingSocial(true);
    setSocialError('');
    setSocialSuccess('');

    const result = await onSaveSocial({
      month,
      new_followers: parseDecimal(socialForm.new_followers),
      profile_visits: socialForm.profile_visits ? parseDecimal(socialForm.profile_visits) : null,
      source: socialForm.source.trim() || 'manual_monthly_followers',
      notes: socialForm.notes.trim() || null,
    });

    if (result.error) {
      setSocialError(result.error);
      setSavingSocial(false);
      return;
    }

    setSocialSuccess(`Cierre social guardado para ${getMonthLabel(`${month}-01`)}.`);
    setSavingSocial(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-large" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Carga histórica mensual</h2>
            <p className="modal-subtitle">{clientName} · Guardado manual de Ads, Ventas y Seguidores</p>
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="form-field">
            <label>Mes</label>
            <input
              type="month"
              className="form-input"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
                setAdsError('');
                setSalesError('');
                setSocialError('');
                setAdsSuccess('');
                setSalesSuccess('');
                setSocialSuccess('');
              }}
            />
          </div>

          <div className="history-grid">
            <section className="history-section">
              <div className="section-heading">
                <h2>Ads histórico</h2>
              </div>

              <div className="history-fields-grid">
                <label className="form-field">
                  <span className="form-label">Spend</span>
                  <input className="form-input" type="number" min="0" step="0.01" value={adsForm.spend} onChange={(event) => setAdsField('spend', event.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-label">Reach</span>
                  <input className="form-input" type="number" min="0" step="1" value={adsForm.reach} onChange={(event) => setAdsField('reach', event.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-label">Impressions</span>
                  <input className="form-input" type="number" min="0" step="1" value={adsForm.impressions} onChange={(event) => setAdsField('impressions', event.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-label">Clicks</span>
                  <input className="form-input" type="number" min="0" step="1" value={adsForm.clicks} onChange={(event) => setAdsField('clicks', event.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-label">Messages</span>
                  <input className="form-input" type="number" min="0" step="1" value={adsForm.messages} onChange={(event) => setAdsField('messages', event.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-label">Leads</span>
                  <input className="form-input" type="number" min="0" step="1" value={adsForm.leads} onChange={(event) => setAdsField('leads', event.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-label">Purchases</span>
                  <input className="form-input" type="number" min="0" step="1" value={adsForm.purchases} onChange={(event) => setAdsField('purchases', event.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-label">Purchase Value</span>
                  <input className="form-input" type="number" min="0" step="0.01" value={adsForm.purchase_value} onChange={(event) => setAdsField('purchase_value', event.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-label">CPM</span>
                  <input className="form-input" type="number" min="0" step="0.0001" value={adsForm.cpm} onChange={(event) => setAdsField('cpm', event.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-label">CPC</span>
                  <input className="form-input" type="number" min="0" step="0.0001" value={adsForm.cpc} onChange={(event) => setAdsField('cpc', event.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-label">CTR</span>
                  <input className="form-input" type="number" min="0" step="0.0001" value={adsForm.ctr} onChange={(event) => setAdsField('ctr', event.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-label">ROAS</span>
                  <input className="form-input" type="number" min="0" step="0.0001" value={adsForm.roas} onChange={(event) => setAdsField('roas', event.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-label">CPR</span>
                  <input className="form-input" type="number" min="0" step="0.0001" value={adsForm.cpr} onChange={(event) => setAdsField('cpr', event.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-label">CPL</span>
                  <input className="form-input" type="number" min="0" step="0.0001" value={adsForm.cpl} onChange={(event) => setAdsField('cpl', event.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-label">CPA</span>
                  <input className="form-input" type="number" min="0" step="0.0001" value={adsForm.cpa} onChange={(event) => setAdsField('cpa', event.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-label">Frequency</span>
                  <input className="form-input" type="number" min="0" step="0.0001" value={adsForm.frequency} onChange={(event) => setAdsField('frequency', event.target.value)} />
                </label>
              </div>

              {adsError && <p className="empty-note">{adsError}</p>}
              {!adsError && adsSuccess && <p className="history-success">{adsSuccess}</p>}

              <div className="history-actions">
                <button className="btn-primary" onClick={() => void handleSaveAds()} disabled={!canSaveAds || savingAds}>
                  {savingAds ? 'Guardando Ads...' : 'Guardar Ads histórico'}
                </button>
              </div>
            </section>

            <section className="history-section">
              <div className="section-heading">
                <h2>Ventas histórico</h2>
              </div>

              <div className="history-fields-grid">
                <label className="form-field">
                  <span className="form-label">Ventas totales</span>
                  <input className="form-input" type="number" min="0" step="0.01" value={salesForm.total_sales} onChange={(event) => setSalesField('total_sales', event.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-label">Cliente nuevo</span>
                  <input className="form-input" type="number" min="0" step="0.01" value={salesForm.new_client_sales} onChange={(event) => setSalesField('new_client_sales', event.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-label">Recompra</span>
                  <input className="form-input" type="number" min="0" step="0.01" value={salesForm.repeat_sales} onChange={(event) => setSalesField('repeat_sales', event.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-label">Punto físico</span>
                  <input className="form-input" type="number" min="0" step="0.01" value={salesForm.physical_store_sales} onChange={(event) => setSalesField('physical_store_sales', event.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-label">Online</span>
                  <input className="form-input" type="number" min="0" step="0.01" value={salesForm.online_sales} onChange={(event) => setSalesField('online_sales', event.target.value)} />
                </label>
              </div>

              <label className="form-field">
                <span className="form-label">Observaciones</span>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={salesForm.observations}
                  onChange={(event) => setSalesField('observations', event.target.value)}
                  placeholder="Contexto del mes, promociones, cierre contable, etc."
                />
              </label>

              {salesError && <p className="empty-note">{salesError}</p>}
              {!salesError && salesSuccess && <p className="history-success">{salesSuccess}</p>}
              {!salesError && !salesSuccess && salesValidation.totalsMismatch && (
                <p className="empty-note">Cliente nuevo + recompra no coincide con el total. Se guardará igual.</p>
              )}
              {!salesError && !salesSuccess && salesValidation.channelsMismatch && (
                <p className="empty-note">Punto físico + online no coincide con el total. Se guardará igual.</p>
              )}

              <div className="history-actions">
                <button className="btn-primary" onClick={() => void handleSaveSales()} disabled={!canSaveSales || savingSales}>
                  {savingSales ? 'Guardando ventas...' : 'Guardar ventas históricas'}
                </button>
              </div>
            </section>

            <section className="history-section">
              <div className="section-heading">
                <h2>Seguidores mensual</h2>
              </div>

              <div className="history-fields-grid">
                <label className="form-field">
                  <span className="form-label">Nuevos seguidores</span>
                  <input className="form-input" type="number" min="0" step="1" value={socialForm.new_followers} onChange={(event) => setSocialField('new_followers', event.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-label">Visitas al perfil</span>
                  <input className="form-input" type="number" min="0" step="1" value={socialForm.profile_visits} onChange={(event) => setSocialField('profile_visits', event.target.value)} />
                </label>
                <label className="form-field">
                  <span className="form-label">Fuente</span>
                  <input className="form-input" type="text" value={socialForm.source} onChange={(event) => setSocialField('source', event.target.value)} placeholder="manual_monthly_followers" />
                </label>
              </div>

              <label className="form-field">
                <span className="form-label">Notas</span>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={socialForm.notes}
                  onChange={(event) => setSocialField('notes', event.target.value)}
                  placeholder="Seguidores cargados al cierre mensual. No se infieren desde Ads."
                />
              </label>

              {socialError && <p className="empty-note">{socialError}</p>}
              {!socialError && socialSuccess && <p className="history-success">{socialSuccess}</p>}
              {!socialError && !socialSuccess && (
                <p className="empty-note">Usa cierre mensual manual. Los seguidores no se infieren desde Ads.</p>
              )}

              <div className="history-actions">
                <button className="btn-primary" onClick={() => void handleSaveSocial()} disabled={!canSaveSocial || savingSocial}>
                  {savingSocial ? 'Guardando social...' : 'Guardar cierre social'}
                </button>
              </div>
            </section>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
