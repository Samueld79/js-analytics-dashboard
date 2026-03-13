import { ExternalLink, X } from 'lucide-react';
import type {
  CampaignEntry,
  ChecklistItem,
  Client,
  DriveLink,
  SegmentationData,
  Strategy,
  StrategyHistory,
} from '../lib/supabase';
import { formatCop } from '../lib/utils';

interface Props {
  strategy: Strategy;
  client: Client | null;
  history?: StrategyHistory[];
  historyLoading?: boolean;
  generatingTasks?: boolean;
  onClose: () => void;
  onStatusChange: (status: Strategy['status']) => void;
  onEdit?: () => void;
  onGenerateTasks?: () => void;
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
}: Props) {
  const checklist = strategy.ai_checklist as ChecklistItem[];
  const campaignsNew = strategy.campaigns_new as CampaignEntry[];
  const campaignsOff = strategy.campaigns_off as CampaignEntry[];
  const campaignsOpt = strategy.campaigns_optimize as CampaignEntry[];
  const driveLinks = strategy.drive_links as DriveLink[];
  const seg = strategy.segmentation as SegmentationData;

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
            <select
              className="status-select"
              value={strategy.status}
              onChange={(event) => onStatusChange(event.target.value as Strategy['status'])}
            >
              <option value="pending">Pendiente</option>
              <option value="mounted">Montada</option>
              <option value="reviewed">Revisada</option>
              <option value="approved">Aprobada</option>
            </select>
            <button className="modal-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body modal-scroll">
          {(onEdit || onGenerateTasks) && (
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

          {strategy.monthly_budget && (
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

          {strategy.notes && (
            <section className="strategy-section">
              <h3 className="strategy-section-title">Notas</h3>
              <p className="notes-text">{strategy.notes}</p>
            </section>
          )}

          {strategy.raw_input && (
            <section className="strategy-section">
              <h3 className="strategy-section-title">Texto original</h3>
              <pre className="raw-input">{strategy.raw_input}</pre>
            </section>
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
