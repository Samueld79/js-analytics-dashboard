import type { Campaign } from './types';
import type { BrandKit, ToolKnowledgeBase } from '../../../services/aiToolsService';

export type GeneradorForm = {
  objetivo: string;
  presupuesto: string;
  contexto: string;
  numCampanas: string;
  extra: string;
};

export function buildGeneradorPrompt(
  form: GeneradorForm,
  kit: BrandKit | null,
  knowledge: ToolKnowledgeBase | null,
): string {
  const kitSection = kit
    ? `=== CLIENTE ===
Nombre: ${kit.name}
Colores: ${kit.colors || 'no definido'}
Fuentes: ${kit.fonts || 'no definido'}
Voz de marca: ${kit.voice || 'no definido'}
Audiencias objetivo: ${kit.audiences || 'no definido'}
Diferenciadores: ${kit.differentiators || 'no definido'}
No hacer: ${kit.do_not || 'no definido'}`
    : '=== CLIENTE ===\n(Sin kit de marca — usa criterio general para el mercado colombiano)';

  const knowledgeSection = knowledge?.content
    ? `\n=== CONOCIMIENTO BASE ===\n${knowledge.content}\n`
    : '';

  const presupuestoMensual = Number(form.presupuesto.replace(/\D/g, ''));
  const presupuestoDiario = presupuestoMensual > 0
    ? `$${Math.round(presupuestoMensual / 30).toLocaleString('es-CO')} COP/día (≈ $${presupuestoMensual.toLocaleString('es-CO')} COP/mes)`
    : form.presupuesto;

  return `${kitSection}
${knowledgeSection}
=== SOLICITUD ===
Objetivo principal: ${form.objetivo}
Presupuesto mensual disponible: $${form.presupuesto} COP → equivale a ${presupuestoDiario}
Contexto especial: ${form.contexto}
Número de campañas solicitadas: ${form.numCampanas}
${form.extra ? `Indicaciones adicionales: ${form.extra}` : ''}

=== INSTRUCCIONES DE OUTPUT ===
Genera una estrategia completa de Meta Ads lista para montar. Toma TODAS las decisiones técnicas.

Para CADA CAMPAÑA incluye:
- Nombre exacto (formato: [Cliente]_[Etapa]_[MesAño])
- Objetivo de Meta (Reconocimiento / Tráfico / Interacción / Clientes potenciales / Ventas)
- Tipo de presupuesto: ABO o CBO con justificación de 1 línea
- Presupuesto diario en COP (distribuyendo el total entre campañas/conjuntos)

Para CADA CONJUNTO dentro de la campaña:
- Nombre descriptivo del conjunto
- Objetivo de rendimiento exacto de Meta Ads
- Ubicación de conversión si aplica
- Audiencia detallada: lugares (país + ciudades clave), edad mínima y máxima, género
- Públicos personalizados a incluir (de: IG engagement 365d, FB engagement 365d, video views 25/50/75/95%, visitantes web 180d, lookalike 1%)
- Exclusiones recomendadas
- Plataformas activas (cuáles sí, cuáles no, con razón de 1 línea)
- Presupuesto diario del conjunto en COP

Para CADA ANUNCIO dentro del conjunto:
- Formato recomendado (Video Reel / Imagen / Carrusel) con justificación
- Ángulo de venta aplicado (TOFU/MOFU/BOFU)
- Copy sugerido: texto principal + CTA (usar la voz de marca del kit del cliente)
- Configuración de conversaciones: mensaje de bienvenida + 3 preguntas frecuentes sugeridas
- Multi-anunciante: activado o desactivado con razón

AL FINAL del organigrama:
- Resumen ejecutivo: total inversión diaria, mensual, número de campañas/conjuntos/anuncios
- KPIs objetivo con valores reales del mercado colombiano para este nicho
- 3-5 recomendaciones accionables específicas para este cliente
- Sección "⚠️ Para confirmar con el cliente:" con cualquier dato que no tengas completamente claro

${ORGANIGRAMA_FORMAT_INSTRUCTIONS}`;
}

export function buildFormPrompt(
  campaigns: Campaign[],
  kit: BrandKit | null,
  knowledge: ToolKnowledgeBase | null,
  contextNote: string,
): string {
  const kitSection = kit
    ? `## CLIENTE: ${kit.name}
### KIT DE MARCA
- Colores: ${kit.colors || 'no definido'}
- Fuentes: ${kit.fonts || 'no definido'}
- Voz: ${kit.voice || 'no definido'}
- Audiencias: ${kit.audiences || 'no definido'}
- Diferenciadores: ${kit.differentiators || 'no definido'}
- No hacer: ${kit.do_not || 'no definido'}`
    : '## CLIENTE: Sin kit de marca (usa criterio general para mercado colombiano)';

  const knowledgeSection = knowledge?.content
    ? `\n## BASE DE CONOCIMIENTO\n${knowledge.content}\n`
    : '';

  const contextSection = contextNote.trim()
    ? `\n## CONTEXTO ADICIONAL DEL USUARIO\n${contextNote.trim()}\n`
    : '';

  const campaignsText = campaigns
    .map((c, ci) => {
      const sets = c.conjuntos
        .map((s, si) => {
          const ads = s.anuncios
            .map((a, ai) => {
              const tipoStr =
                a.tipo === 'existente'
                  ? `Publicación existente`
                  : `Anuncio nuevo — Formato: ${a.formato}`;
              return `
        ANUNCIO ${ai + 1}
          Tipo: ${tipoStr}
          Ángulo: ${a.angulo}
          URL: ${a.url || 'N/A'}
          Multi-anunciante: ${a.multiAnunciante ? 'SÍ' : 'NO'}
          Copy: ${a.copy || '(sin copy)'}
          Plantilla conversación: ${a.tipoPlantilla}${a.plantillaNombre ? ` — "${a.plantillaNombre}"` : ''}
          Saludo: ${a.saludo || '(sin saludo)'}
          Pregunta 1: ${a.pregunta1 || '(vacío)'}
          Pregunta 2: ${a.pregunta2 || '(vacío)'}
          Pregunta 3: ${a.pregunta3 || '(vacío)'}`;
            })
            .join('');

          const plataformasOn = Object.entries(s.plataformas)
            .filter(([, v]) => v)
            .map(([k]) =>
              k === 'audienceNetwork'
                ? 'Audience Network'
                : k.charAt(0).toUpperCase() + k.slice(1),
            )
            .join(', ');
          const plataformasOff = Object.entries(s.plataformas)
            .filter(([, v]) => !v)
            .map(([k]) =>
              k === 'audienceNetwork'
                ? 'Audience Network'
                : k.charAt(0).toUpperCase() + k.slice(1),
            )
            .join(', ');

          const incluir = s.incluirPublicos.length
            ? s.incluirPublicos.join(', ')
            : 'ninguno';

          const presSet =
            c.tipoPresupuesto === 'ABO' && s.presupuesto
              ? `\n      Presupuesto: $${s.presupuesto.toLocaleString('es-CO')} COP/día`
              : '';

          const ubicacion = s.ubicacionConversion
            ? `\n      Ubicación de conversión: ${s.ubicacionConversion}`
            : '';
          const tipoInt = s.tipoInteraccion
            ? `\n      Tipo de interacción: ${s.tipoInteraccion}`
            : '';

          return `
      CONJUNTO ${si + 1}: ${s.nombre || '(sin nombre)'}
        Objetivo de rendimiento: ${s.objetivoRendimiento || '(no seleccionado)'}${ubicacion}${tipoInt}${presSet}
        AUDIENCIA
          Lugares: ${s.lugares || 'Colombia (general)'}
          Advantage+ Audience: ${s.advantagePlus ? 'ACTIVADO' : 'DESACTIVADO'}
          Edad: ${s.edadMin}–${s.edadMaxPlus ? '65+' : s.edadMax} años
          Género: ${s.genero}
          Incluir públicos: ${incluir}${s.otrosPublicos ? `, ${s.otrosPublicos}` : ''}
          Excluir públicos: ${s.excluirPublicos || 'ninguno'}
        PLATAFORMAS ACTIVAS: ${plataformasOn || 'ninguna'}
        PLATAFORMAS EXCLUIDAS: ${plataformasOff || 'ninguna'}
        ${ads}`;
        })
        .join('');

      const presCamp =
        c.tipoPresupuesto === 'CBO' && c.presupuesto
          ? `\n  Presupuesto campaña: $${c.presupuesto.toLocaleString('es-CO')} COP/día`
          : '';

      return `
CAMPAÑA ${ci + 1}: ${c.nombre || '(sin nombre)'}
  Objetivo Meta: ${c.objetivo}
  Tipo de presupuesto: ${c.tipoPresupuesto}${presCamp}
  ${sets}`;
    })
    .join('\n');

  return `${kitSection}
${knowledgeSection}${contextSection}
## ESTRUCTURA DE CAMPAÑA INGRESADA
${campaignsText}

## INSTRUCCIÓN
Genera el organigrama completo de estrategia de Meta Ads usando EXACTAMENTE el formato de plantilla que sigue. Enriquece cada sección con razonamiento estratégico breve basado en el kit de marca del cliente y los benchmarks del mercado colombiano.

Reglas de enriquecimiento:
- En "💡 Razonamiento" de cada campaña: 1-2 oraciones explicando por qué el objetivo es correcto para este cliente
- En "💡" de plataformas de cada conjunto: 1 oración justificando las inclusiones/exclusiones
- En "Recomendaciones" del resumen: 3-5 insights accionables y específicos para este cliente y nicho
- En "KPIs objetivo": usa benchmarks reales del mercado colombiano para este objetivo/nicho

FORMATO DE SALIDA EXACTO:

┌─────────────────────────────────────────────────────────────┐
│  ⚡ ESTRATEGIA: [cliente] · [mes año actual]                 │
│  Generado por Growth Strategy JS                            │
└─────────────────────────────────────────────────────────────┘
[una línea en blanco]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 CAMPAÑA [N]: [nombre]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Objetivo Meta:        [objetivo]
💰 Tipo presupuesto:     [ABO o CBO con monto]
💡 Razonamiento:         [1-2 oraciones estratégicas]
[una línea en blanco]
  ┌──────────────────────────────────────────────────┐
  │ 📦 CONJUNTO [N]: [nombre]                        │
  ├──────────────────────────────────────────────────┤
  │ 🎯 Rendimiento:    [objetivo]                    │
  │ 📍 Conversión:     [ubicacion o N/A]             │
  │ 💰 Presupuesto:    [monto o heredado de CBO]     │
  │                                                  │
  │ 👥 AUDIENCIA                                     │
  │  ├─ Lugares:       [lugares]                     │
  │  ├─ Edad:          [rango]                       │
  │  ├─ Género:        [genero]                      │
  │  ├─ Incluir:       [lista o ninguno]             │
  │  ├─ Excluir:       [lista o ninguno]             │
  │  └─ Fuera config:  [SÍ / NO]                    │
  │                                                  │
  │ 📱 PLATAFORMAS                                   │
  │  ├─ ✅ [plataformas activas una por línea]       │
  │  ├─ ❌ [plataformas excluidas una por línea]     │
  │  └─ 💡 [razonamiento 1 oración]                 │
  │                                                  │
  │ 🎨 ANUNCIO [N]                                   │
  │  ├─ Tipo:          [tipo] · [ángulo]             │
  │  ├─ URL:           [url o N/A]                   │
  │  ├─ Multi-anunc:   [SÍ / NO]                    │
  │  ├─ Copy:          [copy completo]               │
  │  └─ Conversación:                                │
  │     • Saludo: [texto]                            │
  │     • P1: [pregunta]                             │
  │     • P2: [pregunta]                             │
  │     • P3: [pregunta]                             │
  └──────────────────────────────────────────────────┘
[repetir para cada conjunto y campaña]
[una línea en blanco]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 RESUMEN EJECUTIVO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total inversión diaria:   $X.XXX COP
Total inversión mensual:  $X.XXX.XXX COP (~30 días)
Número de campañas:       X
Número de conjuntos:      X
Número de anuncios:       X
KPIs objetivo:
  • [KPI específico con valor benchmark Colombia]
  • [otro KPI con valor]
  • [otro KPI con valor]
Recomendaciones:
  1. [insight accionable específico]
  2. [insight accionable específico]
  3. [insight accionable específico]`;
}

const IMAGE_SYSTEM_PREFIX = `Eres un estratega experto de Meta Ads para el mercado colombiano, trabajando para la agencia Growth Strategy JS.`;

export function buildImagePrompt(contextNote: string, kit: BrandKit | null): string {
  const kitSection = kit
    ? `\nCLIENTE: ${kit.name}\nVoz: ${kit.voice || 'no definida'}\nAudiencias: ${kit.audiences || 'no definidas'}`
    : '';

  return `${IMAGE_SYSTEM_PREFIX}${kitSection}

Analiza la imagen adjunta (mapa mental, pizarrón o captura de estrategia de Meta Ads).

Instrucciones:
1. Extrae TODA la información visible: campañas, objetivos, conjuntos, anuncios, audiencias, presupuestos, plataformas
2. Interpreta texto parcialmente legible usando el contexto de Meta Ads colombiano
3. Estructura la información en el organigrama estándar con el mismo formato de plantilla
4. Enriquece con razonamiento estratégico donde sea útil
5. Al final agrega:
   ⚠️ Información faltante: [lista de campos obligatorios que no pudiste determinar]

${contextNote ? `CONTEXTO DEL USUARIO: ${contextNote}\n` : ''}
${ORGANIGRAMA_FORMAT_INSTRUCTIONS}`;
}

export function buildTranscriptPrompt(
  transcripcion: string,
  kit: BrandKit | null,
  knowledge: ToolKnowledgeBase | null,
): string {
  const kitSection = kit
    ? `CLIENTE: ${kit.name} — Voz: ${kit.voice || 'N/D'} — Audiencias: ${kit.audiences || 'N/D'}`
    : 'CLIENTE: Sin kit de marca';

  const knowledgeSection = knowledge?.content
    ? `\nBASE DE CONOCIMIENTO:\n${knowledge.content}\n`
    : '';

  return `${IMAGE_SYSTEM_PREFIX}
${kitSection}
${knowledgeSection}

TRANSCRIPCIÓN / NOTAS:
${transcripcion}

Instrucciones:
1. Interpreta el lenguaje natural y extrae la estructura de campaña Meta Ads
2. Asigna valores a: objetivo, tipo de presupuesto, conjuntos, anuncios, audiencias, plataformas
3. Estructura en el organigrama estándar con razonamiento estratégico
4. Al final agrega:
   ⚠️ Información faltante: [lo obligatorio que no se mencionó]
   ❓ Por confirmar: [ambigüedades detectadas]

${ORGANIGRAMA_FORMAT_INSTRUCTIONS}`;
}

const ORGANIGRAMA_FORMAT_INSTRUCTIONS = `FORMATO DE SALIDA EXACTO (usa este template):

┌─────────────────────────────────────────────────────────────┐
│  ⚡ ESTRATEGIA: [cliente] · [mes año]                        │
│  Generado por Growth Strategy JS                            │
└─────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 CAMPAÑA [N]: [nombre]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Objetivo Meta:        [objetivo]
💰 Tipo presupuesto:     [ABO o CBO con monto]
💡 Razonamiento:         [razonamiento estratégico]

  ┌──────────────────────────────────────────────────┐
  │ 📦 CONJUNTO [N]: [nombre]                        │
  ├──────────────────────────────────────────────────┤
  │ 🎯 Rendimiento:    [objetivo rendimiento]        │
  │ 📍 Conversión:     [ubicacion]                   │
  │ 💰 Presupuesto:    [monto COP/día]               │
  │ 👥 AUDIENCIA                                     │
  │  ├─ Lugares:       [...]                         │
  │  ├─ Edad:          [...]                         │
  │  ├─ Género:        [...]                         │
  │  ├─ Incluir:       [...]                         │
  │  ├─ Excluir:       [...]                         │
  │  └─ Fuera config:  [SÍ/NO]                      │
  │ 📱 PLATAFORMAS                                   │
  │  ├─ ✅ [activas]                                 │
  │  ├─ ❌ [excluidas]                               │
  │  └─ 💡 [razonamiento]                           │
  │ 🎨 ANUNCIO [N]                                   │
  │  ├─ Tipo:    [tipo] · [ángulo]                   │
  │  ├─ URL:     [url o N/A]                         │
  │  ├─ Multi:   [SÍ/NO]                             │
  │  ├─ Copy:    [texto]                             │
  │  └─ Conversación:                                │
  │     • Saludo: [texto]                            │
  │     • P1: [...]  P2: [...]  P3: [...]            │
  └──────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 RESUMEN EJECUTIVO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total inversión diaria:   $X.XXX COP
Total inversión mensual:  $X.XXX.XXX COP
Número de campañas:       X | Conjuntos: X | Anuncios: X
KPIs objetivo:
  • [KPI con valor benchmark Colombia]
  • [KPI con valor]
Recomendaciones:
  1. [insight accionable]
  2. [insight accionable]
  3. [insight accionable]`;
