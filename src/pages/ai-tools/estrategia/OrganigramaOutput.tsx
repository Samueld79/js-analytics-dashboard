import { useCallback, useMemo, useRef, useState } from 'react';
import html2pdf from 'html2pdf.js';
import { Copy, Check, BookmarkPlus, CheckCircle, Send, ChevronDown, ChevronUp, Link2 } from 'lucide-react';
import {
  insertToolOutput,
  updateToolOutputInputs,
} from '../../../services/aiToolsService';
import { useAITools } from '../../../hooks/useAIToolsContext';

// ─── JSON schema types ────────────────────────────────────────────────────────

type OrganigramaAd = {
  tipo?: string;
  formato?: string;
  angulo?: string;
  url?: string;
  multiAnunciante?: boolean;
  copy?: string;
  conversacion?: {
    tipoPlantilla?: string;
    saludo?: string;
    preguntas?: string[];
  };
};

type OrganigramaAdSet = {
  nombre?: string;
  objetivoRendimiento?: string;
  ubicacionConversion?: string;
  presupuesto?: string;
  audiencia?: {
    lugares?: string;
    edad?: string;
    genero?: string;
    incluir?: string[];
    excluir?: string;
    advantagePlus?: boolean | string;
  };
  plataformas?: {
    activas?: string[];
    excluidas?: string[];
    razonamiento?: string;
  };
  anuncios?: OrganigramaAd[];
};

type OrganigamaCampaña = {
  nombre?: string;
  objetivo?: string;
  tipoPresupuesto?: string;
  presupuesto?: string;
  razonamiento?: string;
  conjuntos?: OrganigramaAdSet[];
};

type OrganigramaData = {
  cliente?: string;
  fecha?: string;
  campanas?: OrganigamaCampaña[];
  resumen?: {
    totalDiario?: string;
    totalMensual?: string;
    numCampanas?: number;
    numConjuntos?: number;
    numAnuncios?: number;
    kpis?: string[];
    recomendaciones?: string[];
  };
  paraConfirmar?: string[];
};

// ─── Parser ───────────────────────────────────────────────────────────────────

function tryParseOrganigrama(text: string): OrganigramaData | null {
  try {
    const trimmed = text.trim();
    if (trimmed.startsWith('{')) return JSON.parse(trimmed) as OrganigramaData;
    const mdMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (mdMatch?.[1]) return JSON.parse(mdMatch[1]) as OrganigramaData;
    const objMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]) as OrganigramaData;
    return null;
  } catch {
    return null;
  }
}

// ─── Copy text builder (readable text from JSON) ─────────────────────────────

function buildCopyText(data: OrganigramaData): string {
  const lines: string[] = [];
  lines.push(`⚡ ESTRATEGIA: ${data.cliente ?? 'Cliente'} · ${data.fecha ?? ''}`);
  lines.push('Generado por Growth Strategy JS');
  lines.push('');
  (data.campanas ?? []).forEach((c, ci) => {
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(`📋 CAMPAÑA ${ci + 1}: ${c.nombre ?? ''}`);
    lines.push(`🎯 ${c.objetivo ?? ''} · ${c.tipoPresupuesto ?? ''} · ${c.presupuesto ?? ''}`);
    if (c.razonamiento) lines.push(`💡 ${c.razonamiento}`);
    lines.push('');
    (c.conjuntos ?? []).forEach((s, si) => {
      lines.push(`  📦 CONJUNTO ${si + 1}: ${s.nombre ?? ''}`);
      lines.push(`  🎯 ${s.objetivoRendimiento ?? ''}${s.ubicacionConversion ? ' · ' + s.ubicacionConversion : ''}${s.presupuesto ? ' · ' + s.presupuesto : ''}`);
      if (s.audiencia?.lugares) lines.push(`  👥 ${s.audiencia.lugares}${s.audiencia.edad ? ' | ' + s.audiencia.edad : ''}${s.audiencia.genero ? ' | ' + s.audiencia.genero : ''}`);
      if (s.audiencia?.incluir?.length) lines.push(`  ✅ Incluir: ${s.audiencia.incluir.join(', ')}`);
      if (s.audiencia?.excluir) lines.push(`  ❌ Excluir: ${s.audiencia.excluir}`);
      if (s.plataformas?.activas?.length) lines.push(`  📱 ${s.plataformas.activas.join(' · ')}`);
      if (s.plataformas?.razonamiento) lines.push(`  💡 ${s.plataformas.razonamiento}`);
      lines.push('');
      (s.anuncios ?? []).forEach((a, ai) => {
        lines.push(`    🎨 ANUNCIO ${ai + 1}: ${a.formato ?? ''} · ${a.angulo ?? ''}`);
        if (a.copy) lines.push(`    Copy:\n${a.copy.split('\n').map(l => `      ${l}`).join('\n')}`);
        if (a.conversacion?.saludo) {
          lines.push(`    Saludo: ${a.conversacion.saludo}`);
          (a.conversacion.preguntas ?? []).forEach((p, pi) => lines.push(`    P${pi + 1}: ${p}`));
        }
        lines.push('');
      });
    });
  });
  if (data.resumen) {
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('📊 RESUMEN EJECUTIVO');
    if (data.resumen.totalDiario) lines.push(`Total diario: ${data.resumen.totalDiario}`);
    if (data.resumen.totalMensual) lines.push(`Total mensual: ${data.resumen.totalMensual}`);
    lines.push(`${data.resumen.numCampanas ?? 0} campañas · ${data.resumen.numConjuntos ?? 0} conjuntos · ${data.resumen.numAnuncios ?? 0} anuncios`);
    data.resumen.kpis?.forEach(k => lines.push(`  • ${k}`));
    data.resumen.recomendaciones?.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
  }
  if (data.paraConfirmar?.length) {
    lines.push('');
    lines.push('⚠️ Por confirmar:');
    data.paraConfirmar.forEach(p => lines.push(`  • ${p}`));
  }
  return lines.join('\n');
}

// ─── Visual sub-components ───────────────────────────────────────────────────

type PillColor = 'cyan' | 'green' | 'purple' | 'amber' | 'gray';

function Pill({ text, color = 'gray' }: { text: string; color?: PillColor }) {
  const map: Record<PillColor, { bg: string; c: string }> = {
    cyan: { bg: 'color-mix(in srgb, var(--color-accent-cyan) 12%, transparent)', c: 'var(--color-accent-cyan)' },
    green: { bg: 'color-mix(in srgb, #22c55e 12%, transparent)', c: '#22c55e' },
    purple: { bg: 'color-mix(in srgb, #818cf8 12%, transparent)', c: '#818cf8' },
    amber: { bg: 'color-mix(in srgb, hsl(38,92%,55%) 12%, transparent)', c: 'hsl(38,92%,60%)' },
    gray: { bg: 'rgba(255,255,255,0.06)', c: 'var(--color-text-muted)' },
  };
  const { bg, c } = map[color];
  return (
    <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: bg, color: c, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
}

function AdCard({ ad, index }: { ad: OrganigramaAd; index: number }) {
  const [open, setOpen] = useState(true);
  const [convOpen, setConvOpen] = useState(false);
  const showMeta = ad.url || ad.multiAnunciante !== undefined;
  const copyPreview = ad.copy ? ad.copy.replace(/\n/g, ' ').substring(0, 80) + (ad.copy.length > 80 ? '…' : '') : null;

  return (
    <div style={{ border: '1px solid color-mix(in srgb, #818cf8 30%, var(--color-border))', borderRadius: 8 }}>
      <div
        onClick={() => setOpen(p => !p)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '7px 12px', cursor: 'pointer',
          background: 'color-mix(in srgb, #818cf8 8%, var(--color-bg-secondary))',
          borderRadius: open ? '8px 8px 0 0' : 8,
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#818cf8', letterSpacing: '0.06em', flexShrink: 0 }}>
            🎨 ANUNCIO {index + 1}
          </span>
          {ad.formato && <Pill text={ad.formato} color="purple" />}
          {ad.angulo && !open && (
            <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ad.angulo}
            </span>
          )}
          {!open && copyPreview && (
            <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
              {copyPreview}
            </span>
          )}
          {open && ad.angulo && (
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ad.angulo}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={13} color="var(--color-text-muted)" /> : <ChevronDown size={13} color="var(--color-text-muted)" />}
      </div>

      {open && (
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {showMeta && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {ad.url && <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>🔗 {ad.url}</span>}
              {ad.multiAnunciante !== undefined && (
                <Pill
                  text={`Multi-anunciante: ${ad.multiAnunciante ? 'ON' : 'OFF'}`}
                  color={ad.multiAnunciante ? 'green' : 'gray'}
                />
              )}
            </div>
          )}
          {ad.copy && (
            <div>
              <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#818cf8', marginBottom: 5, letterSpacing: '0.08em' }}>COPY</div>
              <div style={{
                fontSize: '0.83rem', lineHeight: 1.7, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap',
                background: 'color-mix(in srgb, #818cf8 5%, var(--color-bg-secondary))',
                padding: '10px 12px', borderRadius: 6, borderLeft: '3px solid #818cf8',
              }}>
                {ad.copy}
              </div>
            </div>
          )}
          {ad.conversacion && (
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
              <div
                onClick={() => setConvOpen(c => !c)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: convOpen ? 8 : 0 }}
              >
                <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#818cf8', letterSpacing: '0.08em', flex: 1 }}>
                  💬 CONVERSACIÓN {!convOpen && <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, fontStyle: 'italic' }}>· clic para ver</span>}
                </div>
                {convOpen ? <ChevronUp size={11} color="var(--color-text-muted)" /> : <ChevronDown size={11} color="var(--color-text-muted)" />}
              </div>
              {convOpen && (
                <>
                  {ad.conversacion.tipoPlantilla && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                      Plantilla: {ad.conversacion.tipoPlantilla}
                    </div>
                  )}
                  {ad.conversacion.saludo && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Saludo: </span>
                      {ad.conversacion.saludo}
                    </div>
                  )}
                  {ad.conversacion.preguntas?.map((p, pi) => (
                    <div key={pi} style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginBottom: 3 }}>
                      <span style={{ fontWeight: 600 }}>P{pi + 1}:</span> {p}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdSetCard({ adset, index }: { adset: OrganigramaAdSet; index: number }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ border: '1px solid color-mix(in srgb, #22c55e 30%, var(--color-border))', borderRadius: 10 }}>
      <div
        onClick={() => setOpen(p => !p)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 14px', cursor: 'pointer',
          background: 'color-mix(in srgb, #22c55e 8%, var(--color-bg-secondary))',
          borderRadius: open ? '10px 10px 0 0' : 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#22c55e', letterSpacing: '0.06em', flexShrink: 0 }}>
            📦 CONJUNTO {index + 1}
          </span>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {adset.nombre ?? '(sin nombre)'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {adset.presupuesto && <Pill text={adset.presupuesto} color="green" />}
          {open ? <ChevronUp size={13} color="var(--color-text-muted)" /> : <ChevronDown size={13} color="var(--color-text-muted)" />}
        </div>
      </div>

      {open && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {adset.objetivoRendimiento && <Pill text={`🎯 ${adset.objetivoRendimiento}`} color="green" />}
            {adset.ubicacionConversion && <Pill text={`📍 ${adset.ubicacionConversion}`} color="gray" />}
          </div>

          {adset.audiencia && (
            <div>
              <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#22c55e', marginBottom: 6, letterSpacing: '0.08em' }}>👥 AUDIENCIA</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 12px', fontSize: '0.76rem', marginBottom: 6 }}>
                {adset.audiencia.lugares && (
                  <><span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Lugares</span><span style={{ color: 'var(--color-text-secondary)' }}>{adset.audiencia.lugares}</span></>
                )}
                {adset.audiencia.edad && (
                  <><span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Edad</span><span style={{ color: 'var(--color-text-secondary)' }}>{adset.audiencia.edad}</span></>
                )}
                {adset.audiencia.genero && (
                  <><span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Género</span><span style={{ color: 'var(--color-text-secondary)' }}>{adset.audiencia.genero}</span></>
                )}
                {adset.audiencia.excluir && (
                  <><span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Excluir</span><span style={{ color: 'var(--color-text-secondary)' }}>{adset.audiencia.excluir}</span></>
                )}
              </div>
              {(adset.audiencia.incluir?.length ?? 0) > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {adset.audiencia.incluir!.map((p, i) => <Pill key={i} text={`✅ ${p}`} color="green" />)}
                </div>
              )}
            </div>
          )}

          {adset.plataformas && (
            <div>
              <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#22c55e', marginBottom: 6, letterSpacing: '0.08em' }}>📱 PLATAFORMAS</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                {adset.plataformas.activas?.map((p, i) => <Pill key={i} text={`✅ ${p}`} color="green" />)}
                {adset.plataformas.excluidas?.map((p, i) => <Pill key={`x${i}`} text={`❌ ${p}`} color="gray" />)}
              </div>
              {adset.plataformas.razonamiento && (
                <p style={{ fontSize: '0.72rem', fontStyle: 'italic', color: 'hsl(215,80%,72%)', margin: 0 }}>
                  💡 {adset.plataformas.razonamiento}
                </p>
              )}
            </div>
          )}

          {(adset.anuncios?.length ?? 0) > 0 && (
            <div style={{ borderLeft: '2px dashed var(--color-border)', marginLeft: 4, paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {adset.anuncios!.map((a, ai) => <AdCard key={ai} ad={a} index={ai} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CampañaCard({ campaña, index }: { campaña: OrganigamaCampaña; index: number }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{
      border: '2px solid color-mix(in srgb, var(--color-accent-cyan) 45%, var(--color-border))',
      borderRadius: 12, overflow: 'hidden', marginBottom: 20,
    }}>
      <div
        onClick={() => setOpen(p => !p)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 18px', cursor: 'pointer',
          background: 'color-mix(in srgb, var(--color-accent-cyan) 8%, var(--color-bg-secondary))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--color-accent-cyan)', letterSpacing: '0.08em', flexShrink: 0 }}>
            📋 CAMPAÑA {index + 1}
          </span>
          <span style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {campaña.nombre ?? '(sin nombre)'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {campaña.objetivo && <Pill text={campaña.objetivo} color="cyan" />}
          {campaña.tipoPresupuesto && <Pill text={campaña.tipoPresupuesto} color="gray" />}
          {open ? <ChevronUp size={14} color="var(--color-text-muted)" /> : <ChevronDown size={14} color="var(--color-text-muted)" />}
        </div>
      </div>

      {open && (
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {campaña.presupuesto && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.06em' }}>PRESUPUESTO</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-text-primary)', fontWeight: 600 }}>{campaña.presupuesto}</span>
            </div>
          )}
          {campaña.razonamiento && (
            <p style={{ fontSize: '0.78rem', fontStyle: 'italic', color: 'hsl(215,80%,72%)', margin: 0 }}>
              💡 {campaña.razonamiento}
            </p>
          )}
          {(campaña.conjuntos?.length ?? 0) > 0 && (
            <div style={{ borderLeft: '2px dashed var(--color-border)', marginLeft: 8, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {campaña.conjuntos!.map((s, si) => <AdSetCard key={si} adset={s} index={si} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResumenCard({ resumen }: { resumen: NonNullable<OrganigramaData['resumen']> }) {
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', marginTop: 4 }}>
      <div style={{
        padding: '10px 18px', borderBottom: '1px solid var(--color-border)',
        background: 'color-mix(in srgb, var(--color-accent-cyan) 5%, var(--color-bg-secondary))',
        fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '0.06em',
      }}>
        📊 RESUMEN EJECUTIVO
      </div>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {resumen.totalDiario && (
            <div style={{ textAlign: 'center', background: 'var(--color-bg-secondary)', padding: '10px 14px', borderRadius: 8 }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>{resumen.totalDiario}</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginTop: 2 }}>inversión diaria</div>
            </div>
          )}
          {resumen.totalMensual && (
            <div style={{ textAlign: 'center', background: 'var(--color-bg-secondary)', padding: '10px 14px', borderRadius: 8 }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>{resumen.totalMensual}</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginTop: 2 }}>inversión mensual</div>
            </div>
          )}
          {resumen.numCampanas !== undefined && (
            <div style={{ textAlign: 'center', background: 'var(--color-bg-secondary)', padding: '10px 18px', borderRadius: 8 }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-accent-cyan)' }}>{resumen.numCampanas}</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>campañas</div>
            </div>
          )}
          {resumen.numConjuntos !== undefined && (
            <div style={{ textAlign: 'center', background: 'var(--color-bg-secondary)', padding: '10px 18px', borderRadius: 8 }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#22c55e' }}>{resumen.numConjuntos}</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>conjuntos</div>
            </div>
          )}
          {resumen.numAnuncios !== undefined && (
            <div style={{ textAlign: 'center', background: 'var(--color-bg-secondary)', padding: '10px 18px', borderRadius: 8 }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#818cf8' }}>{resumen.numAnuncios}</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>anuncios</div>
            </div>
          )}
        </div>
        {(resumen.kpis?.length ?? 0) > 0 && (
          <div>
            <div style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--color-accent-cyan)', marginBottom: 8, letterSpacing: '0.08em' }}>KPIs OBJETIVO</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {resumen.kpis!.map((k, i) => (
                <div key={i} style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--color-accent-cyan)', flexShrink: 0 }}>•</span>
                  <span>{k}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {(resumen.recomendaciones?.length ?? 0) > 0 && (
          <div>
            <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#22c55e', marginBottom: 8, letterSpacing: '0.08em' }}>RECOMENDACIONES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {resumen.recomendaciones!.map((r, i) => (
                <div key={i} style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', display: 'flex', gap: 8 }}>
                  <span style={{ color: '#22c55e', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const MODE_LABELS: Record<string, string> = {
  generador: '✨ IA',
  formulario: '📋 Formulario',
  imagen: '🖼️ Imagen',
  transcripcion: '🎙️ Voz',
};

function VisualOrganigrama({ data, mode }: { data: OrganigramaData; mode?: string }) {
  const timestamp = new Date().toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const modeLabel = mode ? (MODE_LABELS[mode] ?? mode) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--color-border)',
        background: 'color-mix(in srgb, var(--color-accent-cyan) 4%, var(--color-bg-secondary))',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--color-accent-cyan)', letterSpacing: '0.12em' }}>
            ⚡ ESTRATEGIA META ADS · GROWTH STRATEGY JS
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {modeLabel && (
              <span style={{
                fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: 'color-mix(in srgb, var(--color-accent-cyan) 15%, transparent)',
                color: 'var(--color-accent-cyan)',
                border: '1px solid color-mix(in srgb, var(--color-accent-cyan) 30%, transparent)',
              }}>
                {modeLabel}
              </span>
            )}
            <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>{timestamp}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {data.cliente ?? 'Cliente'}
          </span>
          {data.fecha && (
            <span style={{ fontSize: '0.82rem', fontWeight: 400, color: 'var(--color-text-muted)' }}>{data.fecha}</span>
          )}
        </div>
      </div>

      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {(data.campanas ?? []).map((c, i) => <CampañaCard key={i} campaña={c} index={i} />)}
        {data.resumen && <ResumenCard resumen={data.resumen} />}
        {(data.paraConfirmar?.length ?? 0) > 0 && (
          <div style={{
            marginTop: 12, padding: '12px 16px',
            background: 'color-mix(in srgb, hsl(38,92%,55%) 8%, var(--color-bg-secondary))',
            border: '1px solid color-mix(in srgb, hsl(38,92%,55%) 30%, var(--color-border))',
            borderRadius: 10,
          }}>
            <div style={{ fontSize: '0.58rem', fontWeight: 700, color: 'hsl(38,92%,60%)', marginBottom: 8, letterSpacing: '0.08em' }}>
              ⚠️ POR CONFIRMAR CON EL CLIENTE
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {data.paraConfirmar!.map((p, i) => (
                <div key={i} style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', display: 'flex', gap: 8 }}>
                  <span style={{ color: 'hsl(38,92%,60%)', flexShrink: 0 }}>•</span>
                  <span>{p}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Text fallback renderer ───────────────────────────────────────────────────

function colorizeLine(line: string, index: number) {
  const trimmed = line.trim();
  if (trimmed.startsWith('┌') || trimmed.startsWith('└') || trimmed.startsWith('┐') || trimmed.startsWith('┘'))
    return <div key={index} style={{ color: 'var(--color-accent-cyan)', opacity: 0.7 }}>{line}</div>;
  if (trimmed.startsWith('━━'))
    return <div key={index} style={{ color: 'var(--color-accent-cyan)', opacity: 0.5 }}>{line}</div>;
  if (trimmed.startsWith('│  ⚡') || trimmed.startsWith('│  Generado'))
    return <div key={index} style={{ color: 'var(--color-text-primary)', fontWeight: trimmed.includes('⚡') ? 700 : 400, fontSize: trimmed.includes('⚡') ? '0.9rem' : undefined }}>{line}</div>;
  if (trimmed.startsWith('📋'))
    return <div key={index} style={{ color: 'var(--color-text-primary)', fontWeight: 800, fontSize: '0.88rem', marginTop: 4 }}>{line}</div>;
  if (trimmed.match(/^(🎯|💰|💡)/))
    return <div key={index} style={{ color: trimmed.startsWith('💡') ? 'hsl(215,80%,72%)' : 'var(--color-text-secondary)', fontStyle: trimmed.startsWith('💡') ? 'italic' : 'normal' }}>{line}</div>;
  if (trimmed.startsWith('│ 📦'))
    return <div key={index} style={{ color: 'var(--color-accent-cyan)', fontWeight: 700 }}>{line}</div>;
  if (trimmed.startsWith('├──') || trimmed.startsWith('└──'))
    return <div key={index} style={{ color: 'var(--color-border-strong)', opacity: 0.8 }}>{line}</div>;
  if (trimmed.match(/^\│\s+(👥|📱|🎨|🎯|📍|💰|💬)/))
    return <div key={index} style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{line}</div>;
  if (line.includes('✅')) return <div key={index} style={{ color: 'hsl(145,100%,55%)' }}>{line}</div>;
  if (line.includes('❌')) return <div key={index} style={{ color: 'var(--color-text-muted)' }}>{line}</div>;
  if (line.includes('⚠️')) return <div key={index} style={{ color: 'hsl(38,92%,60%)' }}>{line}</div>;
  if (line.includes('❓')) return <div key={index} style={{ color: 'hsl(260,80%,72%)' }}>{line}</div>;
  if (trimmed.startsWith('📊'))
    return <div key={index} style={{ color: 'var(--color-text-primary)', fontWeight: 800, fontSize: '0.88rem', marginTop: 4 }}>{line}</div>;
  if (trimmed.startsWith('•') || trimmed.match(/^\d+\./))
    return <div key={index} style={{ color: 'var(--color-text-secondary)' }}>{line}</div>;
  if (!trimmed) return <div key={index} style={{ height: 6 }} />;
  return <div key={index} style={{ color: 'var(--color-text-secondary)' }}>{line}</div>;
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  output: string;
  toolKey: string;
  formSummary: Record<string, unknown>;
  mode?: string;
};

export function OrganigramaOutput({ output, toolKey, formSummary, mode }: Props) {
  const { selectedClientId } = useAITools();
  const parsed = useMemo(() => tryParseOrganigrama(output), [output]);
  const contentRef = useRef<HTMLDivElement>(null);

  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [marked, setMarked] = useState(false);
  const [marking, setMarking] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  const handleCopy = useCallback(async () => {
    const text = parsed ? buildCopyText(parsed) : output;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output, parsed]);

  const handleExportPDF = useCallback(async () => {
    const element = contentRef.current;
    if (!element || exportingPdf) return;
    setExportingPdf(true);
    const prev = { overflow: element.style.overflow, maxHeight: element.style.maxHeight };
    element.style.overflow = 'visible';
    element.style.maxHeight = 'none';
    try {
      const clientName = (parsed?.cliente ?? 'Estrategia').replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9]/g, '_');
      const fileDate = new Date().toLocaleDateString('es-CO').replace(/\//g, '-');
      await html2pdf()
        .set({
          margin: [15, 15, 15, 15],
          filename: `Estrategia_${clientName}_${fileDate}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
        })
        .from(element)
        .save();
    } finally {
      element.style.overflow = prev.overflow;
      element.style.maxHeight = prev.maxHeight;
      setExportingPdf(false);
    }
  }, [parsed, exportingPdf]);

  const handleSaveInternal = useCallback(async (): Promise<string | null> => {
    if (saved && savedId) return savedId;
    if (!selectedClientId) return null;
    setSaving(true);
    const { data } = await insertToolOutput({ client_id: selectedClientId, tool_key: toolKey, inputs: formSummary, output });
    const id = data?.id ?? null;
    if (id) setSavedId(id);
    setSaved(true);
    setSaving(false);
    return id;
  }, [saved, savedId, selectedClientId, toolKey, formSummary, output]);

  const handleSave = useCallback(async () => {
    if (saving || saved) return;
    await handleSaveInternal();
  }, [saving, saved, handleSaveInternal]);

  const handleCopyLink = useCallback(async () => {
    if (!selectedClientId) {
      showToast('⚠️ Selecciona un cliente para generar el enlace');
      return;
    }
    const id = await handleSaveInternal();
    if (!id) {
      showToast('⚠️ No se pudo guardar la estrategia');
      return;
    }
    const url = `${window.location.origin}/ai-tools/historial?preview=${id}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
    showToast('✅ Enlace copiado — válido para quien tenga acceso a Agency OS');
  }, [selectedClientId, handleSaveInternal]);

  const handleMarkForSamuel = useCallback(async () => {
    if (!savedId || marking || marked) return;
    setMarking(true);
    await updateToolOutputInputs(savedId, { ...formSummary, ready_for_review: true });
    setMarked(true);
    setMarking(false);
  }, [savedId, marking, marked, formSummary]);

  return (
    <div ref={outputRef} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-accent-cyan)', borderRadius: 14, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 18px', borderBottom: '1px solid var(--color-border)',
        background: 'color-mix(in srgb, var(--color-accent-cyan) 5%, var(--color-bg-secondary))',
        gap: 8, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--color-accent-cyan)', textTransform: 'uppercase' }}>
          ⚡ Organigrama generado
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn-ghost" onClick={() => void handleCopy()} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: '0.76rem' }}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copiado' : 'Copiar texto'}
          </button>
          <button
            className="btn-ghost"
            onClick={() => void handleExportPDF()}
            disabled={exportingPdf}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: '0.76rem', opacity: exportingPdf ? 0.6 : 1 }}
          >
            {exportingPdf ? (
              <>
                <span style={{ width: 12, height: 12, border: '1.5px solid rgba(0,0,0,0.15)', borderTop: '1.5px solid currentColor', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                Generando...
              </>
            ) : '📄 Exportar PDF'}
          </button>
          <button
            className="btn-ghost"
            onClick={() => void handleCopyLink()}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: '0.76rem', color: linkCopied ? '#22c55e' : undefined }}
          >
            {linkCopied ? <Check size={13} /> : <Link2 size={13} />}
            {linkCopied ? 'Enlace copiado' : 'Copiar enlace'}
          </button>
          {selectedClientId && (
            <button
              className="btn-ghost"
              onClick={() => void handleSave()}
              disabled={saving || saved}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: '0.76rem', color: saved ? '#22c55e' : undefined }}
            >
              {saved ? <CheckCircle size={13} /> : <BookmarkPlus size={13} />}
              {saved ? 'Guardado' : saving ? 'Guardando...' : 'Guardar'}
            </button>
          )}
          {savedId && !marked && (
            <button
              onClick={() => void handleMarkForSamuel()}
              disabled={marking}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: '0.76rem',
                fontWeight: 700, borderRadius: 8, border: 'none', cursor: marking ? 'default' : 'pointer',
                background: 'hsl(38,92%,55%)', color: '#000', opacity: marking ? 0.6 : 1,
              }}
            >
              <Send size={13} />
              {marking ? 'Enviando...' : '📤 Marcar para Samuel'}
            </button>
          )}
          {marked && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: '0.76rem', fontWeight: 700, color: '#22c55e' }}>
              <CheckCircle size={13} /> ✅ Samuel puede verlo en Historial
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {parsed ? (
        <div ref={contentRef} id="organigrama-content" style={{ maxHeight: 900, overflowY: 'auto' }}>
          <VisualOrganigrama data={parsed} mode={mode} />
        </div>
      ) : (
        <div ref={contentRef} id="organigrama-content" style={{
          padding: '20px 24px', fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.78rem', lineHeight: 1.65, overflowX: 'auto',
          maxHeight: 700, overflowY: 'auto',
        }}>
          {output.split('\n').map((line, i) => colorizeLine(line, i))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
          background: 'var(--color-bg-card)',
          border: '1px solid color-mix(in srgb, #22c55e 60%, transparent)',
          borderRadius: 12, padding: '12px 18px', fontSize: '0.82rem',
          color: 'var(--color-text-primary)', boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', gap: 8, maxWidth: 400,
          animation: 'fadeInUp 0.2s ease',
        }}>
          <CheckCircle size={15} style={{ color: '#22c55e', flexShrink: 0 }} />
          {toast}
        </div>
      )}
      <style>{`@keyframes fadeInUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
