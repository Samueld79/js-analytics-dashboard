import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, ImageIcon, Loader2, Share2, Upload, Video } from 'lucide-react';
import { useClients } from '../hooks/useClients';
import { GlassCard } from '../components/ui-custom/GlassCard';
import { PrimaryButton } from '../components/ui-custom/PrimaryButton';
import {
  generatePortalPin,
  generatePortalSlug,
  listClientPortalSettings,
  listDistinctCampaignNames,
  listPortalCreativeAssets,
  upsertClientPortalSettings,
  upsertPortalCreativeAsset,
  uploadPortalCreativeFile,
} from '../services/portal';
import type { ClientPortalSettings, PortalCreativeAsset } from '../lib/supabase';

function CreativeAssetRow({
  clientId,
  campaignName,
  asset,
  onSaved,
}: {
  clientId: string;
  campaignName: string;
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
    const uploadResult = await uploadPortalCreativeFile(clientId, campaignName, file);
    if (uploadResult.error || !uploadResult.data) {
      setUploading(false);
      alert(uploadResult.error ?? 'No se pudo subir el archivo.');
      return;
    }

    const saveResult = await upsertPortalCreativeAsset({
      client_id: clientId,
      campaign_name: campaignName,
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
      campaign_name: campaignName,
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
        ) : asset?.asset_type === 'video' ? (
          <Video size={18} style={{ color: 'var(--fg-muted)' }} />
        ) : asset?.asset_url ? (
          <img src={asset.asset_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <ImageIcon size={18} style={{ color: 'var(--fg-muted)' }} />
        )}
        <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFile} style={{ display: 'none' }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {campaignName}
        </div>
        <input
          className="form-input"
          placeholder="Conjunto (ej. Conjunto 1 (Reseñas))"
          value={conjuntoLabel}
          onChange={(e) => setConjuntoLabel(e.target.value)}
          onBlur={handleLabelBlur}
          style={{ marginTop: 6, fontSize: '0.76rem', padding: '6px 10px' }}
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
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const [campaignNames, setCampaignNames] = useState<string[]>([]);
  const [assets, setAssets] = useState<PortalCreativeAsset[]>([]);
  const [loadingCreatives, setLoadingCreatives] = useState(false);

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
    } else {
      setEnabled(false);
      setSlug('');
      setPinRegistro('');
      setPinVentas('');
    }
    setCopied(false);
  }, [currentSettings, selectedClientId]);

  useEffect(() => {
    if (!selectedClientId) return;
    setLoadingCreatives(true);
    Promise.all([
      listDistinctCampaignNames(selectedClientId),
      listPortalCreativeAssets(selectedClientId),
    ]).then(([names, rows]) => {
      setCampaignNames(names);
      setAssets(rows);
      setLoadingCreatives(false);
    });
  }, [selectedClientId]);

  const assetByCampaign = useMemo(
    () => new Map(assets.map((a) => [a.campaign_name, a])),
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
            ) : campaignNames.length === 0 ? (
              <p style={{ color: 'var(--fg-muted)', fontSize: '0.8rem' }}>
                No hay campañas registradas en ad_campaign_metrics para este cliente todavía.
              </p>
            ) : (
              <div>
                {campaignNames.map((name) => (
                  <CreativeAssetRow
                    key={name}
                    clientId={selectedClientId}
                    campaignName={name}
                    asset={assetByCampaign.get(name)}
                    onSaved={(asset) =>
                      setAssets((prev) => [...prev.filter((a) => a.campaign_name !== asset.campaign_name), asset])
                    }
                  />
                ))}
              </div>
            )}
            <p style={{ marginTop: 12, fontSize: '0.68rem', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Upload size={11} /> Clic en la miniatura para subir imagen o video de referencia — se guarda una vez por creativo.
            </p>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
