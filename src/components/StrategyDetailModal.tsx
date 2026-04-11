import { ChevronDown, ChevronUp, ExternalLink, Link, X } from 'lucide-react';
import { useState } from 'react';

function CreativeDescription({ text }: { text: string }) {
  const trimmed = text.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return (
      <a
        href={trimmed}
        target="_blank"
        rel="noreferrer"
        style={{
          fontSize: '0.75rem', color: 'hsl(180,100%,55%)', textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 4,
          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '100%',
        }}
      >
        <Link size={11} style={{ flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{trimmed}</span>
      </a>
    );
  }
  const parts = trimmed.split(/[•\n]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    return (
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {parts.map((part, i) => (
          <li key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: '0.77rem', color: '#8094b8' }}>
            <span style={{ color: 'hsl(180,100%,50%)', flexShrink: 0, lineHeight: 1.5 }}>•</span>
            <span style={{ wordBreak: 'break-word' }}>{part}</span>
          </li>
        ))}
      </ul>
    );
  }
  return <span style={{ fontSize: '0.77rem', color: '#8094b8', wordBreak: 'break-word' }}>{trimmed}</span>;
}
import type {
  CampaignEntry,
  ChecklistItem,
  Client,
  DriveLink,
  LeadsInstantForm,
  LeadsLandingConfig,
  LeadsMessagesConfig,
  LeadsMetrics,
  LeadsPostLead,
  MetaAdEntry,
  SegmentationData,
  Strategy,
  StrategyCampaign,
  StrategyHistory,
} from '../lib/supabase';
import { formatCop, statusLabel } from '../lib/utils';

// ─── Leads summary (read-only) ─────────────────────────────────────────────

function LeadsFieldRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={{ fontSize: '0.76rem', color: '#8094b8' }}>
      <span style={{ fontSize: '0.65rem', color: 'rgba(245,158,11,0.7)', marginRight: 5 }}>{label}</span>
      {value}
    </div>
  );
}

function LeadsSummary({ camp }: { camp: StrategyCampaign }) {
  const amber = '#f59e0b';
  const sectionLabel: React.CSSProperties = { fontSize: '0.58rem', fontWeight: 700, color: amber, letterSpacing: '0.1em', display: 'block', marginBottom: 5, fontFamily: 'JetBrains Mono, monospace' };
  const convLoc = camp.leadsConversionLocation;
  const iForm = camp.leadsInstantForm as LeadsInstantForm | null | undefined;
  const msgs = camp.leadsMessages as LeadsMessagesConfig | null | undefined;
  const land = camp.leadsLanding as LeadsLandingConfig | null | undefined;
  const post = camp.leadsPostLead as LeadsPostLead | null | undefined;
  const met = camp.leadsMetrics as LeadsMetrics | null | undefined;

  if (!convLoc && !post && !met) return null;

  return (
    <div style={{ borderTop: '1px solid rgba(245,158,11,0.1)', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(245,158,11,0.02)' }}>
      {/* Conversion location badge */}
      {convLoc && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.6rem', fontWeight: 700, color: amber, letterSpacing: '0.08em' }}>CONVERSIÓN</span>
          <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: '0.68rem', fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: amber, border: '1px solid rgba(245,158,11,0.25)' }}>
            {convLoc}
          </span>
        </div>
      )}

      {/* Instant form summary */}
      {iForm && (
        <div style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(245,158,11,0.15)', background: 'rgba(255,255,255,0.01)' }}>
          <span style={sectionLabel}>FORMULARIO INSTANTÁNEO</span>
          <LeadsFieldRow label="Nombre" value={iForm.formName ?? ''} />
          <LeadsFieldRow label="Tipo" value={iForm.formType === 'volume' ? 'Más volumen' : iForm.formType === 'intent' ? 'Mayor intención' : ''} />
          <LeadsFieldRow label="Título" value={iForm.introTitle ?? ''} />
          {(iForm.questions ?? []).filter(q => q.enabled).length > 0 && (
            <div style={{ marginTop: 5 }}>
              <span style={{ fontSize: '0.62rem', color: 'rgba(245,158,11,0.6)', display: 'block', marginBottom: 3 }}>PREGUNTAS ACTIVAS</span>
              <ol style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {(iForm.questions ?? []).filter(q => q.enabled).map((q, i) => (
                  <li key={i} style={{ fontSize: '0.74rem', color: '#8094b8' }}>{q.label}</li>
                ))}
              </ol>
            </div>
          )}
          <LeadsFieldRow label="Agradecimiento" value={iForm.thankYouTitle ?? ''} />
        </div>
      )}

      {/* Messages summary */}
      {msgs && (
        <div style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(245,158,11,0.15)', background: 'rgba(255,255,255,0.01)' }}>
          <span style={sectionLabel}>CONFIGURACIÓN DE MENSAJES</span>
          {(msgs.platforms ?? []).length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
              {msgs.platforms!.map((p) => <span key={p} style={{ padding: '1px 8px', borderRadius: 4, fontSize: '0.66rem', background: 'rgba(245,158,11,0.12)', color: amber }}>{p}</span>)}
            </div>
          )}
          <LeadsFieldRow label="Saludo" value={msgs.greeting ?? ''} />
        </div>
      )}

      {/* Landing summary */}
      {land && (
        <div style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(245,158,11,0.15)', background: 'rgba(255,255,255,0.01)' }}>
          <span style={sectionLabel}>LANDING PAGE</span>
          <LeadsFieldRow label="URL" value={land.landingUrl ?? ''} />
          <LeadsFieldRow label="Headline" value={land.headline ?? ''} />
          <LeadsFieldRow label="CTA" value={land.cta ?? ''} />
        </div>
      )}

      {/* Post-lead */}
      {post && (
        <div style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(245,158,11,0.1)', background: 'rgba(255,255,255,0.01)', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <span style={sectionLabel}>FLUJO POST-LEAD</span>
          <LeadsFieldRow label="Canal" value={post.contactChannel ?? ''} />
          <LeadsFieldRow label="Respuesta" value={post.responseTime ?? ''} />
          <LeadsFieldRow label="Responsable" value={post.responsible ?? ''} />
          {post.followUpMessage && <div style={{ fontSize: '0.74rem', color: '#8094b8', fontStyle: 'italic', width: '100%' }}>{post.followUpMessage}</div>}
        </div>
      )}

      {/* Metrics */}
      {met && (
        <div style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(245,158,11,0.1)', background: 'rgba(255,255,255,0.01)' }}>
          <span style={sectionLabel}>MÉTRICAS OBJETIVO</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 5 }}>
            {met.expectedCpl != null && (
              <div style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.58rem', color: 'rgba(245,158,11,0.7)', fontWeight: 700 }}>CPL ESPERADO</div>
                <div style={{ fontSize: '0.82rem', color: amber, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                  ${met.expectedCpl.toLocaleString('es-CO')}
                </div>
              </div>
            )}
            {met.expectedCtr && (
              <div style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.58rem', color: 'rgba(245,158,11,0.7)', fontWeight: 700 }}>CTR</div>
                <div style={{ fontSize: '0.82rem', color: amber, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{met.expectedCtr}</div>
              </div>
            )}
            {met.monthlyLeadsGoal != null && (
              <div style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.58rem', color: 'rgba(245,158,11,0.7)', fontWeight: 700 }}>META / MES</div>
                <div style={{ fontSize: '0.82rem', color: amber, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{met.monthlyLeadsGoal} leads</div>
              </div>
            )}
          </div>
          {(met.kpiChecklist ?? []).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {met.kpiChecklist!.map((k) => <span key={k} style={{ padding: '1px 7px', borderRadius: 4, fontSize: '0.64rem', background: 'rgba(245,158,11,0.1)', color: amber }}>{k}</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  strategy: Strategy;
  client: Client | null;
  history?: StrategyHistory[];
  historyLoading?: boolean;
  generatingTasks?: boolean;
  onClose: () => void;
  onStatusChange?: (status: Strategy['status']) => void;
  onEdit?: () => void;
  onGenerateTasks?: () => void;
  readOnly?: boolean;
}

export function StrategyDetailModal({
  strategy: strategy,
  client,
  history = [],
  historyLoading = false,
  generatingTasks = false,
  onClose,
  onStatusChange,
  onEdit,
  onGenerateTasks,
  readOnly = false,
}: Props) {
  const checklist = strategy.ai_checklist as ChecklistItem[];
  const campaignsNew = strategy.campaigns_new as CampaignEntry[];
  const campaignsOff = strategy.campaigns_off as CampaignEntry[];
  const campaignsOpt = strategy.campaigns_optimize as CampaignEntry[];
  const driveLinks = strategy.drive_links as DriveLink[];
  const seg = strategy.segmentation as SegmentationData;
  const richCampaigns = (strategy.campaigns ?? []) as StrategyCampaign[];

  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<number>>(
    () => new Set(richCampaigns.map((_, i) => i)),
  );
  function toggleCampaign(idx: number) {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-large" style={{ maxWidth: 'min(980px, 95vw)' }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{strategy.title}</h2>
            <p className="modal-subtitle">
              {client?.name ?? '—'}
              {strategy.month
                ? ` · ${new Date(`${strategy.month}T12:00:00`).toLocaleDateString('es-CO', {
                    month: 'long',
                    year: 'numeric',
                  })}`
                : ''}
              {` · v${strategy.latest_version ?? strategy.version ?? 1}`}
            </p>
          </div>
          <div className="modal-header-actions">
            {onStatusChange && !readOnly ? (
              <select
                className="status-select"
                value={strategy.status}
                onChange={(event) => onStatusChange(event.target.value as Strategy['status'])}
              >
                <option value="pending">Pendiente</option>
                <option value="active">Activa</option>
                <option value="archived">📦 Archivar</option>
              </select>
            ) : (
              <span className="meta-chip">{statusLabel(strategy.status)}</span>
            )}
            <button className="modal-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body modal-scroll">
          {!readOnly && (onEdit || onGenerateTasks) && (
            <div className="strategy-detail-actions">
              {onEdit && (
                <button className="btn-secondary" onClick={onEdit}>
                  Editar estrategia
                </button>
              )}
              {onGenerateTasks && (
                <button className="btn-primary" onClick={onGenerateTasks} disabled={generatingTasks}>
                  {generatingTasks ? 'Generando tareas...' : 'Generar tareas'}
                </button>
              )}
            </div>
          )}

          <div className="strategy-detail-meta-grid">
            <div className="strategy-detail-meta-item">
              <span className="strategy-detail-meta-label">Estado</span>
              <strong>{statusLabel(strategy.status)}</strong>
            </div>
            <div className="strategy-detail-meta-item">
              <span className="strategy-detail-meta-label">Versión</span>
              <strong>v{strategy.latest_version ?? strategy.version ?? 1}</strong>
            </div>
            <div className="strategy-detail-meta-item">
              <span className="strategy-detail-meta-label">Creada</span>
              <strong>{new Date(strategy.created_at).toLocaleDateString('es-CO', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}</strong>
            </div>
            <div className="strategy-detail-meta-item">
              <span className="strategy-detail-meta-label">Actualizada</span>
              <strong>{new Date(strategy.updated_at).toLocaleDateString('es-CO', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}</strong>
            </div>
          </div>

          {strategy.monthly_budget != null && (
            <div className="strategy-detail-budget">
              Presupuesto mensual: <strong>{formatCop(strategy.monthly_budget)}</strong>
            </div>
          )}

          {strategy.ai_summary && (
            <section className="strategy-section">
              <h3 className="strategy-section-title">Resumen Ejecutivo</h3>
              <p className="strategy-summary-text">{strategy.ai_summary}</p>
            </section>
          )}

          {strategy.ai_diff && (
            <section className="strategy-section">
              <h3 className="strategy-section-title">Cambios vs. estrategia anterior</h3>
              <p className="strategy-summary-text">{strategy.ai_diff}</p>
            </section>
          )}

          {checklist.length > 0 && (
            <section className="strategy-section">
              <h3 className="strategy-section-title">Checklist Operativo</h3>
              <div className="checklist">
                {checklist.map((item, index) => (
                  <div key={`${item.task}-${index}`} className={`checklist-item ${item.done ? 'done' : ''}`}>
                    <span className="checklist-box">{item.done ? '✓' : ''}</span>
                    <div className="checklist-content">
                      <span className="checklist-task">{item.task}</span>
                      {item.notes && <span className="checklist-notes">{item.notes}</span>}
                    </div>
                    {item.priority && (
                      <span className={`priority-pill priority-${item.priority}`}>{item.priority}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="strategy-cols">
            {campaignsNew.length > 0 && (
              <section className="strategy-section">
                <h3 className="strategy-section-title">Campanas Nuevas</h3>
                {campaignsNew.map((campaign, index) => (
                  <div key={`${campaign.name}-${index}`} className="campaign-entry">
                    <strong>{campaign.name}</strong>
                    {campaign.objective && (
                      <span className="campaign-meta">Objetivo: {campaign.objective}</span>
                    )}
                    {campaign.budget != null && (
                      <span className="campaign-meta">Budget: {formatCop(campaign.budget)}</span>
                    )}
                    {campaign.audience && (
                      <span className="campaign-meta">Publico: {campaign.audience}</span>
                    )}
                    {campaign.notes && <span className="campaign-notes">{campaign.notes}</span>}
                  </div>
                ))}
              </section>
            )}

            {campaignsOff.length > 0 && (
              <section className="strategy-section">
                <h3 className="strategy-section-title">Campanas a Apagar</h3>
                {campaignsOff.map((campaign, index) => (
                  <div key={`${campaign.name}-${index}`} className="campaign-entry off">
                    <strong>{campaign.name}</strong>
                    {campaign.reason && <span className="campaign-meta">Razon: {campaign.reason}</span>}
                  </div>
                ))}
              </section>
            )}

            {campaignsOpt.length > 0 && (
              <section className="strategy-section">
                <h3 className="strategy-section-title">Campanas a Optimizar</h3>
                {campaignsOpt.map((campaign, index) => (
                  <div key={`${campaign.name}-${index}`} className="campaign-entry optimize">
                    <strong>{campaign.name}</strong>
                    {campaign.action && <span className="campaign-meta">Accion: {campaign.action}</span>}
                    {campaign.priority && (
                      <span className="campaign-meta">Prioridad: {campaign.priority}</span>
                    )}
                  </div>
                ))}
              </section>
            )}
          </div>

          {strategy.creatives.length > 0 && (
            <section className="strategy-section">
              <h3 className="strategy-section-title">Creativos y piezas</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {strategy.creatives.map((creative, index) => (
                  <div
                    key={`${creative.type ?? 'creative'}-${index}`}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex', flexDirection: 'column', gap: 5,
                      wordBreak: 'break-word', overflowWrap: 'break-word', boxSizing: 'border-box',
                    }}
                  >
                    <strong style={{ fontSize: '0.86rem', color: '#d8e7ff' }}>
                      {creative.type ?? `Creativo ${index + 1}`}
                    </strong>
                    {creative.description && <CreativeDescription text={creative.description} />}
                    {creative.link && (
                      <a
                        href={creative.link}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '0.75rem', color: 'hsl(180,100%,55%)', textDecoration: 'none',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '100%',
                        }}
                      >
                        <ExternalLink size={12} style={{ flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {creative.link}
                        </span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {(seg.ages || seg.cities?.length || seg.audiences?.length || seg.exclusions?.length) && (
            <section className="strategy-section">
              <h3 className="strategy-section-title">Segmentacion</h3>
              <div className="seg-grid">
                {seg.ages && (
                  <div className="seg-item">
                    <span className="seg-label">Edades</span>
                    <span>{seg.ages}</span>
                  </div>
                )}
                {seg.cities?.length ? (
                  <div className="seg-item">
                    <span className="seg-label">Ciudades</span>
                    <span>{seg.cities.join(', ')}</span>
                  </div>
                ) : null}
                {seg.audiences?.length ? (
                  <div className="seg-item">
                    <span className="seg-label">Publicos</span>
                    <span>{seg.audiences.join(' · ')}</span>
                  </div>
                ) : null}
                {seg.exclusions?.length ? (
                  <div className="seg-item">
                    <span className="seg-label">Exclusiones</span>
                    <span>{seg.exclusions.join(', ')}</span>
                  </div>
                ) : null}
              </div>
            </section>
          )}

          {driveLinks.length > 0 && (
            <section className="strategy-section">
              <h3 className="strategy-section-title">Links de Drive</h3>
              <div className="drive-links">
                {driveLinks.map((link, index) => (
                  <a
                    key={`${link.url}-${index}`}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="drive-link"
                  >
                    <ExternalLink size={13} /> {link.label}
                  </a>
                ))}
              </div>
            </section>
          )}

          {richCampaigns.length === 0 && (
            <section className="strategy-section">
              <h3 className="strategy-section-title">Campañas</h3>
              <p className="empty-note">Sin campañas registradas</p>
            </section>
          )}

          {richCampaigns.length > 0 && (
            <section className="strategy-section">
              <h3 className="strategy-section-title">Campañas ({richCampaigns.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {richCampaigns.map((camp, idx) => {
                  const isOpen = expandedCampaigns.has(idx);
                  const objColors: Record<string, { bg: string; color: string }> = {
                    Reconocimiento: { bg: 'hsl(180 100% 50% / 0.12)', color: 'hsl(180,100%,55%)' },
                    Tráfico: { bg: 'hsl(215 80% 55% / 0.15)', color: 'hsl(215,80%,70%)' },
                    Interacción: { bg: 'hsl(280 80% 60% / 0.15)', color: 'hsl(280,80%,70%)' },
                    Ventas: { bg: 'hsl(145 100% 45% / 0.12)', color: 'hsl(145,100%,55%)' },
                    'Generación de leads': { bg: 'hsl(38 100% 55% / 0.12)', color: 'hsl(38,100%,60%)' },
                    Mensajes: { bg: 'hsl(320 80% 60% / 0.12)', color: 'hsl(320,80%,65%)' },
                    General: { bg: 'rgba(255,255,255,0.07)', color: 'hsl(215,15%,55%)' },
                  };
                  const objStyle = objColors[camp.objective ?? 'General'] ?? objColors.General;
                  return (
                    <div
                      key={idx}
                      style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}
                    >
                      {/* Campaign header (clickable) */}
                      <button
                        type="button"
                        onClick={() => toggleCampaign(idx)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 16px', background: 'rgba(255,255,255,0.03)', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#d8e7ff' }}>{camp.name}</span>
                          {camp.objective && (
                            <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: '0.64rem', fontWeight: 700, background: objStyle.bg, color: objStyle.color, flexShrink: 0 }}>
                              {camp.objective}
                            </span>
                          )}
                          {camp.budgetType && (
                            <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: '0.62rem', fontWeight: 700, background: 'hsl(180 100% 50% / 0.1)', color: 'hsl(180,100%,55%)', border: '1px solid hsl(180 100% 50% / 0.2)', flexShrink: 0, fontFamily: 'JetBrains Mono, monospace' }}>
                              {camp.budgetType}
                            </span>
                          )}
                          {camp.budget != null && (
                            <span style={{ fontSize: '0.78rem', color: 'hsl(145,100%,55%)', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
                              ${camp.budget.toLocaleString('es-CO')}
                            </span>
                          )}
                          {camp.leadsConversionLocation && (
                            <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: '0.62rem', fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', flexShrink: 0 }}>
                              {camp.leadsConversionLocation}
                            </span>
                          )}
                        </div>
                        {isOpen
                          ? <ChevronUp size={14} style={{ color: 'hsl(180,100%,50%)', flexShrink: 0 }} />
                          : <ChevronDown size={14} style={{ color: 'hsl(215,15%,50%)', flexShrink: 0 }} />}
                      </button>

                      {/* Leads summary (expanded, only for Clientes Potenciales) */}
                      {isOpen && camp.objective === 'Clientes Potenciales' && (
                        <LeadsSummary camp={camp} />
                      )}

                      {/* AdSets (expanded) */}
                      {isOpen && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {(camp.adsets ?? []).length === 0 && (
                            <span style={{ fontSize: '0.76rem', color: 'hsl(215,15%,40%)' }}>Sin conjuntos de anuncios</span>
                          )}
                          {(camp.adsets ?? []).map((adset, adsetIdx) => {
                            const effectivePlatforms = adset.platforms?.length
                              ? adset.platforms
                              : (adset.placements ?? []);
                            const adsToShow: MetaAdEntry[] = adset.ads?.length
                              ? adset.ads
                              : (adset.creatives ?? []).map((cr) => ({
                                  adType: adset.adType ?? undefined,
                                  description: cr.description,
                                  publicationType: cr.publicationType,
                                  existingUrl: cr.existingUrl,
                                }));
                            const sLabel: React.CSSProperties = { fontSize: '0.6rem', fontWeight: 700, color: 'hsl(180,100%,50%)', letterSpacing: '0.08em', display: 'block', marginBottom: 4 };
                            const fLabel: React.CSSProperties = { fontSize: '0.65rem', color: 'hsl(215,15%,45%)', marginRight: 5 };
                            const fValue: React.CSSProperties = { fontSize: '0.76rem', color: '#8094b8' };
                            return (
                              <div
                                key={adsetIdx}
                                style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 10 }}
                              >
                                {/* AdSet header: name + age + gender + ABO */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
                                  {adset.name && (
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#c8d8f0' }}>{adset.name}</span>
                                  )}
                                  <span style={{ fontSize: '0.7rem', color: 'hsl(215,15%,55%)', fontFamily: 'JetBrains Mono, monospace', background: 'rgba(255,255,255,0.07)', padding: '2px 8px', borderRadius: 4 }}>
                                    {adset.ageMin ?? 18}–{adset.ageMax === 65 ? '65+' : (adset.ageMax ?? 65)} años
                                  </span>
                                  {adset.gender && adset.gender !== 'all' && (
                                    <span style={{ fontSize: '0.7rem', color: 'hsl(215,15%,55%)', background: 'rgba(255,255,255,0.07)', padding: '2px 8px', borderRadius: 4 }}>
                                      {adset.gender === 'male' ? '♂ Hombres' : '♀ Mujeres'}
                                    </span>
                                  )}
                                  {adset.aboBudgetType != null && adset.aboBudgetAmount != null && (
                                    <span style={{ fontSize: '0.7rem', color: 'hsl(145,100%,55%)', background: 'hsl(145 100% 45% / 0.12)', padding: '2px 8px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace' }}>
                                      ABO ${adset.aboBudgetAmount.toLocaleString('es-CO')}/{adset.aboBudgetType === 'diario' ? 'día' : 'total'}
                                    </span>
                                  )}
                                </div>

                                {/* Dates + Optimization goal */}
                                {(adset.startDate || adset.optimizationGoal) && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                                    {adset.startDate && (
                                      <span style={fValue}>
                                        <span style={fLabel}>FECHAS</span>
                                        {adset.startDate} → {adset.endDate ?? 'sin fecha fin'}
                                      </span>
                                    )}
                                    {adset.optimizationGoal && (
                                      <span style={fValue}>
                                        <span style={fLabel}>OPTIMIZACIÓN</span>
                                        {adset.optimizationGoal}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Objective-based destination fields */}
                                {adset.trafficDestination && (
                                  <span style={fValue}><span style={fLabel}>DESTINO TRÁFICO</span>{adset.trafficDestination}</span>
                                )}
                                {adset.interactionType && (
                                  <span style={fValue}><span style={fLabel}>TIPO INTERACCIÓN</span>{adset.interactionType}</span>
                                )}
                                {adset.conversionDestination && (
                                  <span style={fValue}><span style={fLabel}>DESTINO CONVERSIÓN</span>{adset.conversionDestination}</span>
                                )}
                                {adset.leadsType && (
                                  <span style={fValue}><span style={fLabel}>TIPO LEADS</span>{adset.leadsType}</span>
                                )}
                                {(adset.messageDestinations ?? []).length > 0 && (
                                  <span style={fValue}><span style={fLabel}>DESTINOS MENSAJES</span>{adset.messageDestinations!.join(' · ')}</span>
                                )}

                                {/* Audience block */}
                                {((adset.locations ?? []).length > 0 || adset.detailedTargeting || adset.interests || adset.behaviors || adset.hasCustomAudience || adset.lookalikeAudiences || adset.exclusions) && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <span style={sLabel}>AUDIENCIA</span>
                                    {(adset.locations ?? []).length > 0 && (
                                      <span style={fValue}><span style={fLabel}>Ciudades</span>{adset.locations!.join(' · ')}</span>
                                    )}
                                    {adset.detailedTargeting && (
                                      <span style={fValue}><span style={fLabel}>Segmentación</span>{adset.detailedTargeting}</span>
                                    )}
                                    {adset.interests && (
                                      <span style={fValue}><span style={fLabel}>Intereses</span>{adset.interests}</span>
                                    )}
                                    {adset.behaviors && (
                                      <span style={fValue}><span style={fLabel}>Comportamientos</span>{adset.behaviors}</span>
                                    )}
                                    {adset.hasCustomAudience && adset.customAudienceName && (
                                      <span style={fValue}><span style={fLabel}>Audiencia custom</span>{adset.customAudienceName}</span>
                                    )}
                                    {adset.lookalikeAudiences && (
                                      <span style={fValue}><span style={fLabel}>Lookalike</span>{adset.lookalikeAudiences}</span>
                                    )}
                                    {adset.exclusions && (
                                      <span style={fValue}><span style={fLabel}>Exclusiones</span>{adset.exclusions}</span>
                                    )}
                                  </div>
                                )}

                                {/* Platforms */}
                                {effectivePlatforms.length > 0 && (
                                  <div>
                                    <span style={sLabel}>PLATAFORMAS</span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                      {effectivePlatforms.map((p) => (
                                        <span key={p} style={{ padding: '2px 9px', borderRadius: 4, fontSize: '0.67rem', background: 'hsl(180 100% 50% / 0.1)', color: 'hsl(180,100%,55%)', border: '1px solid hsl(180 100% 50% / 0.2)' }}>
                                          {p}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Adset welcome message (legacy) */}
                                {adset.welcomeMessage && (
                                  <div>
                                    <span style={sLabel}>MSG. BIENVENIDA</span>
                                    <span style={{ ...fValue, display: 'block' }}>{adset.welcomeMessage}</span>
                                  </div>
                                )}

                                {/* Adset notes — cyan left border */}
                                {adset.notes && (
                                  <div style={{ padding: '8px 10px', borderRadius: 6, borderLeft: '3px solid hsl(180,100%,50%)', background: 'hsl(180 100% 50% / 0.05)' }}>
                                    <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'hsl(180,100%,60%)', letterSpacing: '0.08em', display: 'block', marginBottom: 3 }}>
                                      📋 NOTAS DEL CONJUNTO
                                    </span>
                                    <p style={{ fontSize: '0.76rem', color: '#8094b8', margin: 0, whiteSpace: 'pre-wrap' }}>{adset.notes}</p>
                                  </div>
                                )}

                                {/* Ads */}
                                {adsToShow.length > 0 && (
                                  <div>
                                    <span style={sLabel}>ANUNCIOS ({adsToShow.length})</span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                      {adsToShow.map((ad, adIdx) => (
                                        <div key={adIdx} style={{ padding: '8px 11px', borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                                          {/* Badges */}
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                                            {ad.adType && (
                                              <span style={{ fontSize: '0.67rem', padding: '2px 8px', borderRadius: 4, fontWeight: 700, background: 'rgba(255,255,255,0.08)', color: '#c0d0f0' }}>
                                                {ad.adType}
                                              </span>
                                            )}
                                            {ad.publicationType && (
                                              <span style={{ fontSize: '0.67rem', padding: '2px 8px', borderRadius: 4, fontWeight: 700, background: ad.publicationType === 'existente' ? 'hsl(38 100% 55% / 0.15)' : 'hsl(145 100% 45% / 0.12)', color: ad.publicationType === 'existente' ? 'hsl(38,100%,60%)' : 'hsl(145,100%,55%)' }}>
                                                {ad.publicationType === 'existente' ? '♻️ Publicación existente' : '📝 Publicación nueva'}
                                              </span>
                                            )}
                                          </div>
                                          {/* Existing URL */}
                                          {ad.existingUrl && (
                                            <a href={ad.existingUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: 'hsl(180,100%,55%)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                              <ExternalLink size={11} style={{ flexShrink: 0 }} />
                                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ad.existingUrl}</span>
                                            </a>
                                          )}
                                          {/* Reference URL (nueva only) */}
                                          {ad.referenceUrl && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                              <span style={{ fontSize: '0.6rem', color: 'hsl(215,15%,45%)', fontWeight: 700, letterSpacing: '0.06em' }}>🔗 REF. CREATIVA</span>
                                              <a href={ad.referenceUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: 'hsl(180,100%,55%)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                                <Link size={11} style={{ flexShrink: 0 }} />
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ad.referenceUrl}</span>
                                              </a>
                                            </div>
                                          )}
                                          {/* Description / copy */}
                                          {ad.description && (
                                            <p style={{ fontSize: '0.76rem', color: '#8094b8', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{ad.description}</p>
                                          )}
                                          {/* Leads copies V1/V2/V3 */}
                                          {(ad.copyV1 || ad.copyV2 || ad.copyV3) && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                              {([['copyV1', 'V1'], ['copyV2', 'V2'], ['copyV3', 'V3']] as const).map(([field, label]) =>
                                                ad[field] ? (
                                                  <div key={field} style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.04)' }}>
                                                    <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#f59e0b', display: 'block', marginBottom: 2 }}>COPY {label}</span>
                                                    <p style={{ fontSize: '0.75rem', color: '#8094b8', margin: 0, whiteSpace: 'pre-wrap' }}>{ad[field]}</p>
                                                  </div>
                                                ) : null
                                              )}
                                            </div>
                                          )}
                                          {/* Headline + CTA */}
                                          {(ad.headline || ad.ctaButton) && (
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                              {ad.headline && <span style={{ fontSize: '0.76rem', color: '#c8d8f0', fontWeight: 600 }}>{ad.headline}</span>}
                                              {ad.ctaButton && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.66rem', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 700 }}>{ad.ctaButton}</span>}
                                            </div>
                                          )}
                                          {/* Creative idea */}
                                          {ad.creativeIdea && (
                                            <div>
                                              <span style={{ fontSize: '0.6rem', color: 'hsl(215,15%,45%)', fontWeight: 700, letterSpacing: '0.06em', display: 'block', marginBottom: 2 }}>💡 IDEA VISUAL</span>
                                              <span style={{ fontSize: '0.74rem', color: '#8094b8' }}>{ad.creativeIdea}</span>
                                            </div>
                                          )}
                                          {/* Welcome message at ad level */}
                                          {ad.welcomeMessage && (
                                            <div>
                                              <span style={{ fontSize: '0.6rem', color: 'hsl(215,15%,45%)', fontWeight: 700, letterSpacing: '0.06em', display: 'block', marginBottom: 2 }}>MSG. BIENVENIDA</span>
                                              <span style={fValue}>{ad.welcomeMessage}</span>
                                            </div>
                                          )}
                                          {/* Suggested questions */}
                                          {ad.suggestedQuestions && (
                                            <div>
                                              <span style={{ fontSize: '0.6rem', color: 'hsl(215,15%,45%)', fontWeight: 700, letterSpacing: '0.06em', display: 'block', marginBottom: 2 }}>PREGUNTAS SUGERIDAS</span>
                                              <span style={fValue}>{ad.suggestedQuestions}</span>
                                            </div>
                                          )}
                                          {/* Ad notes — amber left border */}
                                          {ad.notes && (
                                            <div style={{ padding: '5px 8px', borderRadius: 4, borderLeft: '3px solid hsl(38,100%,55%)', background: 'hsl(38 100% 55% / 0.05)' }}>
                                              <p style={{ fontSize: '0.72rem', color: 'hsl(38,100%,65%)', margin: 0, fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>{ad.notes}</p>
                                            </div>
                                          )}
                                          {/* Image */}
                                          {ad.imageBase64 && (
                                            <div style={{ marginTop: 2 }}>
                                              <a href={ad.imageBase64} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
                                                <img src={ad.imageBase64} alt="Imagen adjunta" style={{ maxWidth: 180, borderRadius: 7, border: '1px solid rgba(6,182,212,0.2)', display: 'block' }} />
                                              </a>
                                              <span style={{ fontSize: '0.64rem', color: 'hsl(180,100%,50%)', marginTop: 3, display: 'block' }}>📎 Imagen adjunta</span>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {strategy.notes && (
            <section className="strategy-section">
              <h3 className="strategy-section-title">Notas y observaciones estratégicas</h3>
              <p className="notes-text">{strategy.notes}</p>
            </section>
          )}

          {strategy.raw_input && (
            <details className="strategy-disclosure">
              <summary>Texto original del estratega</summary>
              <pre className="raw-input">{strategy.raw_input}</pre>
            </details>
          )}

          <section className="strategy-section">
            <div className="section-heading">
              <h2>Historial de versiones</h2>
            </div>
            {historyLoading ? (
              <p className="empty-note">Cargando historial...</p>
            ) : history.length === 0 ? (
              <p className="empty-note">Todavia no hay versiones guardadas.</p>
            ) : (
              <div className="strategy-history-list">
                {history.map((entry) => (
                  <div key={entry.id} className="strategy-history-item">
                    <div>
                      <strong>v{entry.version}</strong>
                      <span className="strategy-history-date">
                        {new Date(entry.created_at).toLocaleDateString('es-CO', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <span className="strategy-history-summary">
                      {entry.change_summary ?? 'Snapshot guardado'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
