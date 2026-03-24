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
  SegmentationData,
  Strategy,
  StrategyCampaign,
  StrategyHistory,
} from '../lib/supabase';
import { formatCop, statusLabel } from '../lib/utils';

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

  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<number>>(new Set());
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
      <div className="modal-box modal-large" onClick={(event) => event.stopPropagation()}>
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
              <h3 className="strategy-section-title">Campañas</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {richCampaigns.map((camp, idx) => {
                  const isOpen = expandedCampaigns.has(idx);
                  const objColors: Record<string, { bg: string; color: string }> = {
                    Reconocimiento: { bg: 'hsl(180 100% 50% / 0.12)', color: 'hsl(180,100%,55%)' },
                    Tráfico: { bg: 'hsl(215 80% 55% / 0.15)', color: 'hsl(215,80%,70%)' },
                    Interacción: { bg: 'hsl(280 80% 60% / 0.15)', color: 'hsl(280,80%,70%)' },
                    Ventas: { bg: 'hsl(145 100% 45% / 0.12)', color: 'hsl(145,100%,55%)' },
                    General: { bg: 'rgba(255,255,255,0.07)', color: 'hsl(215,15%,55%)' },
                  };
                  const objStyle = objColors[camp.objective ?? 'General'] ?? objColors.General;
                  return (
                    <div
                      key={idx}
                      style={{
                        borderRadius: 9,
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.02)',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Campaign header (clickable) */}
                      <button
                        type="button"
                        onClick={() => toggleCampaign(idx)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center',
                          justifyContent: 'space-between', gap: 10,
                          padding: '10px 14px', background: 'none',
                          border: 'none', cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#d8e7ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {camp.name}
                          </span>
                          {camp.objective && (
                            <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: '0.64rem', fontWeight: 700, background: objStyle.bg, color: objStyle.color, flexShrink: 0 }}>
                              {camp.objective}
                            </span>
                          )}
                          {camp.budgetType && (
                            <span style={{ padding: '2px 7px', borderRadius: 6, fontSize: '0.62rem', fontWeight: 700, background: 'hsl(180 100% 50% / 0.1)', color: 'hsl(180,100%,55%)', border: '1px solid hsl(180 100% 50% / 0.2)', flexShrink: 0, fontFamily: 'JetBrains Mono, monospace' }}>
                              {camp.budgetType}
                            </span>
                          )}
                          {camp.budget != null && (
                            <span style={{ fontSize: '0.78rem', color: 'hsl(145,100%,55%)', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
                              ${camp.budget.toLocaleString('es-CO')}
                            </span>
                          )}
                        </div>
                        {isOpen ? <ChevronUp size={14} style={{ color: 'hsl(180,100%,50%)', flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: 'hsl(215,15%,50%)', flexShrink: 0 }} />}
                      </button>

                      {/* Ad sets detail (expanded) */}
                      {isOpen && (camp.adsets ?? []).length > 0 && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {(camp.adsets ?? []).map((adset, adsetIdx) => (
                            <div
                              key={adsetIdx}
                              style={{ padding: '10px 12px', borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 7 }}
                            >
                              {/* Ad type + age + gender row */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                {adset.adType && (
                                  <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: '0.7rem', fontWeight: 700, background: 'rgba(255,255,255,0.07)', color: '#c0d0f0' }}>
                                    {adset.adType}
                                  </span>
                                )}
                                <span style={{ fontSize: '0.72rem', color: 'hsl(215,15%,55%)', fontFamily: 'JetBrains Mono, monospace' }}>
                                  {adset.ageMin ?? 18} – {adset.ageMax === 65 ? '65+' : (adset.ageMax ?? 65)} años
                                </span>
                                {adset.gender && adset.gender !== 'all' && (
                                  <span style={{ fontSize: '0.7rem', color: 'hsl(215,15%,55%)' }}>
                                    · {adset.gender === 'male' ? 'Hombres' : 'Mujeres'}
                                  </span>
                                )}
                              </div>

                              {/* Locations */}
                              {(adset.locations ?? []).length > 0 && (
                                <div>
                                  <span style={{ fontSize: '0.62rem', color: 'hsl(180,100%,50%)', fontWeight: 700, letterSpacing: '0.08em', display: 'block', marginBottom: 3 }}>CIUDADES</span>
                                  <span style={{ fontSize: '0.76rem', color: '#8094b8' }}>{adset.locations!.join(' · ')}</span>
                                </div>
                              )}

                              {/* Placements */}
                              {(adset.placements ?? []).length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {adset.placements!.map((p) => (
                                    <span key={p} style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.66rem', background: 'rgba(255,255,255,0.05)', color: 'hsl(215,15%,60%)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                      {p}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Creatives */}
                              {(adset.creatives ?? []).length > 0 && (
                                <div>
                                  <span style={{ fontSize: '0.62rem', color: 'hsl(180,100%,50%)', fontWeight: 700, letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>CREATIVOS</span>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    {adset.creatives!.map((cr, crIdx) => (
                                      <div key={crIdx} style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          {cr.publicationType && (
                                            <span style={{ fontSize: '0.62rem', padding: '1px 7px', borderRadius: 4, fontWeight: 700, background: cr.publicationType === 'existente' ? 'hsl(38 100% 55% / 0.15)' : 'hsl(145 100% 45% / 0.12)', color: cr.publicationType === 'existente' ? 'hsl(38,100%,60%)' : 'hsl(145,100%,55%)' }}>
                                              {cr.publicationType === 'existente' ? 'existente' : 'nueva'}
                                            </span>
                                          )}
                                          {cr.description && <span style={{ fontSize: '0.76rem', color: '#8094b8', wordBreak: 'break-word' }}>{cr.description}</span>}
                                        </div>
                                        {cr.existingUrl && (
                                          <a href={cr.existingUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: 'hsl(180,100%,55%)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {cr.existingUrl}
                                          </a>
                                        )}
                                        {cr.notes && <span style={{ fontSize: '0.7rem', color: 'hsl(215,15%,45%)', fontStyle: 'italic' }}>{cr.notes}</span>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Welcome message */}
                              {adset.welcomeMessage && (
                                <div>
                                  <span style={{ fontSize: '0.62rem', color: 'hsl(180,100%,50%)', fontWeight: 700, letterSpacing: '0.08em', display: 'block', marginBottom: 3 }}>MSG. BIENVENIDA</span>
                                  <span style={{ fontSize: '0.76rem', color: '#8094b8' }}>{adset.welcomeMessage}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Empty adsets indicator */}
                      {isOpen && (camp.adsets ?? []).length === 0 && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 14px' }}>
                          <span style={{ fontSize: '0.76rem', color: 'hsl(215,15%,40%)' }}>Sin conjuntos de anuncios</span>
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
