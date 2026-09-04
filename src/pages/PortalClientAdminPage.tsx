import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, Lock, Share2, Upload } from 'lucide-react';
import { useClients } from '../hooks/useClients';
import { GlassCard } from '../components/ui-custom/GlassCard';
import { PortalCreativeThumb } from '../components/PortalCreativeThumb';
import { PrimaryButton } from '../components/ui-custom/PrimaryButton';
import {
  generatePortalPin,
  generatePortalSlug,
  listAdIdNameMap,
  listClientPortalSettings,
  listDistinctAdsForClient,
  listPortalCreativeAssets,
  listPortalDailyEntries,
  listPortalLeads,
  listPortalObjectionTally,
  PORTAL_NOTE_CAMPAIGN_ID,
  upsertClientPortalSettings,
  upsertPortalCreativeAsset,
  uploadPortalCreativeFile,
  type DistinctPortalAd,
} from '../services/portal';
import {
  PORTAL_OBJECTION_TALLY_CATEGORIES,
  PORTAL_VISIT_TALLY_CATEGORIES,
  type ClientPortalSettings,
  type PortalCreativeAsset,
  type PortalDailyEntry,
  type PortalLeadTipo,
  type PortalLeadWithEntry,
  type PortalObjectionTally,
} from '../lib/supabase';
import { formatCop } from '../lib/utils';

function CreativeAssetRow({
  clientId,
  ad,
  asset,
  onSaved,
}: {
  clientId: string;
  ad: DistinctPortalAd;
  asset: PortalCreativeAsset | undefined;
  onSaved: (asset: PortalCreativeAsset) => void;
}) {
  const [conjuntoLabel, setConjuntoLabel] = useState(asset?.conjunto_label ?? '');
  const [uploading, setUploading] = useState(false);
  const [savingLabel, setSavingLabel] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    const uploadResult = await uploadPortalCreativeFile(clientId, ad.ad_id, file);
    if (uploadResult.error || !uploadResult.data) {
      setUploading(false);
      alert(uploadResult.error ?? 'No se pudo subir el archivo.');
      return;
    }

    const saveResult = await upsertPortalCreativeAsset({
      client_id: clientId,
      ad_id: ad.ad_id,
      conjunto_label: conjuntoLabel,
      asset_url: uploadResult.data.asset_url,
      asset_type: uploadResult.data.asset_type,
    });
    setUploading(false);
    if (saveResult.data) onSaved(saveResult.data);
    else if (saveResult.error) alert(saveResult.error);
  };

  const handleLabelBlur = async () => {
    if (conjuntoLabel.trim() === (asset?.conjunto_label ?? '')) return;
    setSavingLabel(true);
    const result = await upsertPortalCreativeAsset({
      client_id: clientId,
      ad_id: ad.ad_id,
      conjunto_label: conjuntoLabel,
      asset_url: asset?.asset_url ?? '',
      asset_type: asset?.asset_type ?? 'image',
    });
    setSavingLabel(false);
    if (result.data) onSaved(result.data);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        style={{
          width: 52, height: 52, borderRadius: 8, flexShrink: 0, cursor: 'pointer',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative',
        }}
        title="Subir imagen o video de referencia"
      >
        {uploading ? (
          <Loader2 size={16} className="spin" style={{ color: 'var(--fg-muted)' }} />
        ) : (
          <PortalCreativeThumb assetUrl={asset?.asset_url} assetType={asset?.asset_type} size={18} />
        )}
        <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFile} style={{ display: 'none' }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ad.ad_name}
        </div>
        <div style={{ fontSize: '0.66rem', color: 'var(--fg-muted)', marginBottom: 4 }}>
          Conjunto en Meta: {ad.adset_name}
        </div>
        <input
          className="form-input"
          placeholder={`Override manual (por defecto: ${ad.adset_name})`}
          value={conjuntoLabel}
          onChange={(e) => setConjuntoLabel(e.target.value)}
          onBlur={handleLabelBlur}
          style={{ fontSize: '0.76rem', padding: '6px 10px' }}
        />
      </div>

      {savingLabel && <Loader2 size={14} className="spin" style={{ color: 'var(--fg-muted)', flexShrink: 0 }} />}
    </div>
  );
}

export function PortalClientAdminPage() {
  const { clients, loading: clientsLoading } = useClients();
  const [selectedClientId, setSelectedClientId] = useState('');
  const [settingsMap, setSettingsMap] = useState<Record<string, ClientPortalSettings>>({});
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [enabled, setEnabled] = useState(false);
  const [slug, setSlug] = useState('');
  const [pinRegistro, setPinRegistro] = useState('');
  const [pinVentas, setPinVentas] = useState('');
  const [pinRequired, setPinRequired] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const [ads, setAds] = useState<DistinctPortalAd[]>([]);
  const [assets, setAssets] = useState<PortalCreativeAsset[]>([]);
  const [loadingCreatives, setLoadingCreatives] = useState(false);

  const [notes, setNotes] = useState<PortalDailyEntry[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  const [leads, setLeads] = useState<PortalLeadWithEntry[]>([]);
  const [adIdToName, setAdIdToName] = useState<Record<string, string>>({});
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [leadDateFrom, setLeadDateFrom] = useState('');
  const [leadDateTo, setLeadDateTo] = useState('');
  const [leadTipoFilter, setLeadTipoFilter] = useState<PortalLeadTipo | 'all'>('all');

  const [tally, setTally] = useState<PortalObjectionTally[]>([]);
  const [loadingTally, setLoadingTally] = useState(false);
  const [tallyDateFrom, setTallyDateFrom] = useState('');
  const [tallyDateTo, setTallyDateTo] = useState('');

  const reloadSettings = async () => {
    setLoadingSettings(true);
    const rows = await listClientPortalSettings();
    setSettingsMap(Object.fromEntries(rows.map((r) => [r.client_id, r])));
    setLoadingSettings(false);
  };

  useEffect(() => {
    void reloadSettings();
  }, []);

  useEffect(() => {
    if (!selectedClientId && clients.length > 0) setSelectedClientId(clients[0].id);
  }, [clients, selectedClientId]);

  const currentSettings = settingsMap[selectedClientId] ?? null;
  const currentClient = clients.find((c) => c.id === selectedClientId) ?? null;

  useEffect(() => {
    if (currentSettings) {
      setEnabled(currentSettings.enabled);
      setSlug(currentSettings.public_slug);
      setPinRegistro(currentSettings.pin_registro);
      setPinVentas(currentSettings.pin_ventas);
      setPinRequired(currentSettings.pin_required);
    } else {
      setEnabled(false);
      setSlug('');
      setPinRegistro('');
      setPinVentas('');
      setPinRequired(true);
    }
    setCopied(false);
  }, [currentSettings, selectedClientId]);

  useEffect(() => {
    if (!selectedClientId) return;
    setLoadingCreatives(true);
    Promise.all([
      listDistinctAdsForClient(selectedClientId),
      listPortalCreativeAssets(selectedClientId),
    ]).then(([adRows, rows]) => {
      setAds(adRows);
      setAssets(rows);
      setLoadingCreatives(false);
    });
  }, [selectedClientId]);

  useEffect(() => {
    if (!selectedClientId) {
      setNotes([]);
      return;
    }
    setLoadingNotes(true);
    listPortalDailyEntries(selectedClientId).then((rows) => {
      setNotes(rows.filter((r) => r.campaign_id === PORTAL_NOTE_CAMPAIGN_ID && r.nota?.trim()));
      setLoadingNotes(false);
    });
  }, [selectedClientId]);

  useEffect(() => {
    if (!selectedClientId) {
      setLeads([]);
      setAdIdToName({});
      return;
    }
    setLoadingLeads(true);
    Promise.all([
      listPortalLeads(selectedClientId),
      listAdIdNameMap(selectedClientId),
    ]).then(([rows, map]) => {
      setLeads(rows);
      setAdIdToName(map);
      setLoadingLeads(false);
    });
  }, [selectedClientId]);

  useEffect(() => {
    if (!selectedClientId) {
      setTally([]);
      return;
    }
    setLoadingTally(true);
    listPortalObjectionTally(selectedClientId).then((rows) => {
      setTally(rows);
      setLoadingTally(false);
    });
  }, [selectedClientId]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (leadTipoFilter !== 'all' && lead.tipo !== leadTipoFilter) return false;
      const date = lead.daily_entry?.date;
      if (leadDateFrom && (!date || date < leadDateFrom)) return false;
      if (leadDateTo && (!date || date > leadDateTo)) return false;
      return true;
    });
  }, [leads, leadTipoFilter, leadDateFrom, leadDateTo]);

  const tallyBreakdown = useMemo(() => {
    const filtered = tally.filter((t) => {
      if (tallyDateFrom && t.date < tallyDateFrom) return false;
      if (tallyDateTo && t.date > tallyDateTo) return false;
      return t.count > 0;
    });
    const objecion = new Map<string, number>();
    const visita = new Map<string, number>();
    for (const t of filtered) {
      const map = t.tipo === 'objecion' ? objecion : visita;
      map.set(t.categoria, (map.get(t.categoria) ?? 0) + t.count);
    }
    return {
      objecion: PORTAL_OBJECTION_TALLY_CATEGORIES.map((c) => ({ categoria: c, count: objecion.get(c) ?? 0 })),
      visita: PORTAL_VISIT_TALLY_CATEGORIES.map((c) => ({ categoria: c, count: visita.get(c) ?? 0 })),
    };
  }, [tally, tallyDateFrom, tallyDateTo]);

  const assetByAdId = useMemo(
    () => new Map(assets.map((a) => [a.ad_id, a])),
    [assets],
  );

  const publicUrl = slug ? `${window.location.origin}/cliente/${slug}` : '';

  const handleToggleEnabled = async (next: boolean) => {
    if (!selectedClientId || !currentClient) return;
    setSaving(true);

    const nextSlug = slug || generatePortalSlug(currentClient.name);
    const nextPinRegistro = pinRegistro || generatePortalPin();
    const nextPinVentas = pinVentas || generatePortalPin();

    const result = await upsertClientPortalSettings({
      client_id: selectedClientId,
      enabled: next,
      public_slug: nextSlug,
      pin_registro: nextPinRegistro,
      pin_ventas: nextPinVentas,
      pin_required: pinRequired,
    });

    setSaving(false);
    if (result.error || !result.data) {
      alert(result.error ?? 'No se pudo guardar.');
      return;
    }
    setSettingsMap((prev) => ({ ...prev, [selectedClientId]: result.data as ClientPortalSettings }));
  };

  const handleSavePins = async () => {
    if (!selectedClientId || !slug) return;
    setSaving(true);
    const result = await upsertClientPortalSettings({
      client_id: selectedClientId,
      enabled,
      public_slug: slug,
      pin_registro: pinRegistro,
      pin_ventas: pinVentas,
      pin_required: pinRequired,
    });
    setSaving(false);
    if (result.error || !result.data) {
      alert(result.error ?? 'No se pudo guardar.');
      return;
    }
    setSettingsMap((prev) => ({ ...prev, [selectedClientId]: result.data as ClientPortalSettings }));
  };

  const handleTogglePinRequired = async (next: boolean) => {
    if (!selectedClientId || !slug) return;
    setSaving(true);
    const result = await upsertClientPortalSettings({
      client_id: selectedClientId,
      enabled,
      public_slug: slug,
      pin_registro: pinRegistro,
      pin_ventas: pinVentas,
      pin_required: next,
    });
    setSaving(false);
    if (result.error || !result.data) {
      alert(result.error ?? 'No se pudo guardar.');
      return;
    }
    setSettingsMap((prev) => ({ ...prev, [selectedClientId]: result.data as ClientPortalSettings }));
  };

  const handleCopyLink = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Portal Cliente</h1>
          <p className="page-subtitle">
            HABILITA Y CONFIGURA EL PORTAL PÚBLICO DE CADA CLIENTE
          </p>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
        <select
          className="form-input"
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          disabled={clientsLoading}
        >
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </select>

        {selectedClientId && !loadingSettings && (
          <GlassCard style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Share2 size={16} style={{ color: 'var(--cyan)' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--fg)' }}>Portal habilitado</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={saving}
                  onChange={(e) => { setEnabled(e.target.checked); void handleToggleEnabled(e.target.checked); }}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {slug && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  <span style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.08em', color: 'var(--fg-muted)', textTransform: 'uppercase' }}>
                    Link público
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="form-input" value={publicUrl} readOnly style={{ flex: 1, fontFamily: 'JetBrains Mono', fontSize: '0.76rem' }} />
                    <PrimaryButton size="sm" onClick={handleCopyLink}>
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? 'Copiado' : 'Copiar link'}
                    </PrimaryButton>
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary"
                      style={{ padding: '7px 14px', fontSize: '0.78rem' }}
                    >
                      <ExternalLink size={14} />
                      Abrir
                    </a>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.08em', color: 'var(--fg-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                      PIN registro diario
                    </span>
                    <input
                      className="form-input"
                      value={pinRegistro}
                      maxLength={4}
                      inputMode="numeric"
                      onChange={(e) => setPinRegistro(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      style={{ fontFamily: 'JetBrains Mono', letterSpacing: '0.2em' }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.08em', color: 'var(--fg-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                      PIN ventas
                    </span>
                    <input
                      className="form-input"
                      value={pinVentas}
                      maxLength={4}
                      inputMode="numeric"
                      onChange={(e) => setPinVentas(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      style={{ fontFamily: 'JetBrains Mono', letterSpacing: '0.2em' }}
                    />
                  </div>
                </div>

                <PrimaryButton size="sm" onClick={handleSavePins} loading={saving} disabled={pinRegistro.length !== 4 || pinVentas.length !== 4}>
                  Guardar PINs
                </PrimaryButton>

                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Lock size={14} style={{ color: 'var(--fg-muted)' }} />
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--fg)', display: 'block' }}>Requiere PIN</span>
                      <span style={{ fontSize: '0.66rem', color: 'var(--fg-muted)' }}>
                        Si lo desactivas, cualquiera con el link registra sin PIN.
                      </span>
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={pinRequired}
                      disabled={saving}
                      onChange={(e) => { setPinRequired(e.target.checked); void handleTogglePinRequired(e.target.checked); }}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </>
            )}
          </GlassCard>
        )}

        {selectedClientId && (
          <GlassCard style={{ padding: 22 }}>
            <span style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.08em', color: 'var(--fg-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 14 }}>
              Creativos de anuncios
            </span>

            {loadingCreatives ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '0.8rem' }}>
                <Loader2 size={16} className="spin" />
              </div>
            ) : ads.length === 0 ? (
              <p style={{ color: 'var(--fg-muted)', fontSize: '0.8rem' }}>
                No hay anuncios registrados en portal_ad_daily_metrics para este cliente todavía.
              </p>
            ) : (
              <div>
                {ads.map((ad) => (
                  <CreativeAssetRow
                    key={ad.ad_id}
                    clientId={selectedClientId}
                    ad={ad}
                    asset={assetByAdId.get(ad.ad_id)}
                    onSaved={(asset) =>
                      setAssets((prev) => [...prev.filter((a) => a.ad_id !== asset.ad_id), asset])
                    }
                  />
                ))}
              </div>
            )}
            <p style={{ marginTop: 12, fontSize: '0.68rem', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Upload size={11} /> Clic en la miniatura para subir imagen o video de referencia — se guarda una vez por creativo. El conjunto viene de Meta (adset_name); el campo de texto es solo para renombrarlo si querés algo distinto.
            </p>
          </GlassCard>
        )}

        {selectedClientId && (
          <GlassCard style={{ padding: 22 }}>
            <span style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.08em', color: 'var(--fg-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 14 }}>
              Notas del día
            </span>

            {loadingNotes ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '0.8rem' }}>
                <Loader2 size={16} className="spin" />
              </div>
            ) : notes.length === 0 ? (
              <p style={{ color: 'var(--fg-muted)', fontSize: '0.8rem' }}>
                Todavía no hay notas registradas desde el portal público.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {notes.map((n) => (
                  <div key={n.id} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono', color: 'var(--fg-muted)', display: 'block', marginBottom: 4 }}>
                      {new Date(`${n.date}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--fg)', whiteSpace: 'pre-wrap' }}>{n.nota}</p>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        )}

        {selectedClientId && (
          <GlassCard style={{ padding: 22 }}>
            <span style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.08em', color: 'var(--fg-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 14 }}>
              Desglose de objeciones / visitas
            </span>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <input
                className="form-input"
                type="date"
                value={tallyDateFrom}
                onChange={(e) => setTallyDateFrom(e.target.value)}
                style={{ width: 150, fontSize: '0.76rem' }}
              />
              <input
                className="form-input"
                type="date"
                value={tallyDateTo}
                onChange={(e) => setTallyDateTo(e.target.value)}
                style={{ width: 150, fontSize: '0.76rem' }}
              />
            </div>

            {loadingTally ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '0.8rem' }}>
                <Loader2 size={16} className="spin" />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <span style={{ fontSize: '0.66rem', color: 'var(--fg-muted)', fontWeight: 700, display: 'block', marginBottom: 8 }}>Objeción</span>
                  {tallyBreakdown.objecion.map((row) => (
                    <div key={row.categoria} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '0.78rem', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--fg-muted)' }}>{row.categoria}</span>
                      <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{row.count}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <span style={{ fontSize: '0.66rem', color: 'var(--fg-muted)', fontWeight: 700, display: 'block', marginBottom: 8 }}>Visita punto físico</span>
                  {tallyBreakdown.visita.map((row) => (
                    <div key={row.categoria} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '0.78rem', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--fg-muted)' }}>{row.categoria}</span>
                      <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{row.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </GlassCard>
        )}

        {selectedClientId && (
          <GlassCard style={{ padding: 22 }}>
            <span style={{ fontSize: '0.62rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.08em', color: 'var(--fg-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 14 }}>
              Seguimiento de clientes
            </span>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <input
                className="form-input"
                type="date"
                value={leadDateFrom}
                onChange={(e) => setLeadDateFrom(e.target.value)}
                style={{ width: 150, fontSize: '0.76rem' }}
              />
              <input
                className="form-input"
                type="date"
                value={leadDateTo}
                onChange={(e) => setLeadDateTo(e.target.value)}
                style={{ width: 150, fontSize: '0.76rem' }}
              />
              <select
                className="form-input"
                value={leadTipoFilter}
                onChange={(e) => setLeadTipoFilter(e.target.value as PortalLeadTipo | 'all')}
                style={{ width: 140, fontSize: '0.76rem' }}
              >
                <option value="all">Todos</option>
                <option value="cita">Citas</option>
                <option value="compra">Compras</option>
              </select>
            </div>

            {loadingLeads ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '0.8rem' }}>
                <Loader2 size={16} className="spin" />
              </div>
            ) : filteredLeads.length === 0 ? (
              <p style={{ color: 'var(--fg-muted)', fontSize: '0.8rem' }}>
                No hay registros para este filtro.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Fecha', 'Anuncio de origen', 'Nombre', 'Número', 'Tipo', 'Monto'].map((h) => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--fg-muted)', fontWeight: 500, fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--fg)', whiteSpace: 'nowrap' }}>
                          {lead.daily_entry?.date
                            ? new Date(`${lead.daily_entry.date}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--fg)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(lead.daily_entry?.campaign_id && adIdToName[lead.daily_entry.campaign_id]) ?? '—'}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--fg)' }}>{lead.nombre_cliente}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--fg)', fontFamily: 'JetBrains Mono', fontSize: '0.74rem' }}>{lead.numero_contacto}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            fontSize: '0.62rem', padding: '2px 8px', borderRadius: 4,
                            background: lead.tipo === 'compra' ? 'var(--success-dim)' : 'var(--cyan-dim)',
                            color: lead.tipo === 'compra' ? 'var(--success)' : 'var(--cyan)',
                          }}>
                            {lead.tipo === 'compra' ? 'Compra' : 'Cita'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--fg)', fontFamily: 'JetBrains Mono', fontSize: '0.76rem' }}>
                          {lead.monto != null ? formatCop(lead.monto) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        )}
      </div>
    </div>
  );
}
