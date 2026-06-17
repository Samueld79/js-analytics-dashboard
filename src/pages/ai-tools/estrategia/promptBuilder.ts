import type { Campaign } from './types';
import type { BrandKit, ToolKnowledgeBase } from '../../../services/aiToolsService';

export type GeneradorForm = {
  objetivo: string;
  presupuesto: string;
  contexto: string;
  numCampanas: string;
  extra: string;
};

const JSON_OUTPUT_INSTRUCTION = `
REGLAS OBLIGATORIAS PARA LOS COPIES:
- PROHIBIDO usar placeholders: "Beneficio 1", "Tu producto aquí", "Resultado X", "CTA aquí"
- Estructura de cada copy: GANCHO (primera línea que detiene el scroll: pregunta directa, dato impactante o afirmación provocadora) + DESARROLLO (1-2 líneas con la propuesta concreta, usando diferenciadores reales del kit) + CTA específico
- El GANCHO debe nombrar el dolor o deseo real de la audiencia de ESTE cliente en específico
- El CTA debe ser concreto según el objetivo: "Escríbenos al IG", "Agenda tu cita gratis", "Ver precio", "Pide el tuyo hoy"
- Usa la voz de marca del kit si está definida; respeta el campo "no hacer"
- Máximo 3 párrafos cortos + CTA. Sin asteriscos. Máximo 2 emojis por copy.
- Cada anuncio debe tener un ángulo DIFERENTE (no copies idénticos con distinto formato)
- Razonamiento de campaña y de plataformas: máximo 1 línea cada uno

FORMATO DE SALIDA — OBLIGATORIO:
Responde ÚNICAMENTE con un objeto JSON válido. Sin texto adicional, sin bloques markdown, sin explicaciones fuera del JSON.

{
  "cliente": "nombre del cliente",
  "fecha": "Junio 2026",
  "campanas": [
    {
      "nombre": "CLIENTE_ETAPA_Jun2026",
      "objetivo": "Tráfico",
      "tipoPresupuesto": "ABO",
      "presupuesto": "$15.000 COP/día por conjunto",
      "razonamiento": "Una sola línea: por qué este objetivo para este cliente.",
      "conjuntos": [
        {
          "nombre": "Nombre descriptivo del conjunto",
          "objetivoRendimiento": "Maximizar visitas a página de destino",
          "ubicacionConversion": "Sitio web",
          "presupuesto": "$15.000 COP/día",
          "audiencia": {
            "lugares": "Colombia · Medellín, Bogotá",
            "edad": "25-44 años",
            "genero": "Todos",
            "incluir": ["IG engagement 365d", "Video views 50%"],
            "excluir": "Compradores últimos 30 días",
            "advantagePlus": false
          },
          "plataformas": {
            "activas": ["Instagram (Feed, Reels, Stories)", "Facebook (Feed, Reels)"],
            "excluidas": ["Audience Network", "Messenger"],
            "razonamiento": "Una línea: por qué estas plataformas para esta audiencia."
          },
          "anuncios": [
            {
              "tipo": "nuevo",
              "formato": "Video Reel 15s",
              "angulo": "TOFU — Reconocimiento / Educativo",
              "url": "",
              "multiAnunciante": false,
              "copy": "Copy completo con gancho real + desarrollo + CTA. Mínimo 3 líneas.",
              "conversacion": {
                "tipoPlantilla": "Plantilla sugerida por Meta",
                "saludo": "Mensaje de bienvenida personalizado para ESTA marca específica",
                "preguntas": [
                  "Pregunta frecuente 1 relevante para este negocio",
                  "Pregunta frecuente 2",
                  "Pregunta frecuente 3"
                ]
              }
            }
          ]
        }
      ]
    }
  ],
  "resumen": {
    "totalDiario": "$XX.XXX COP",
    "totalMensual": "$XXX.XXX COP (~30 días)",
    "numCampanas": 1,
    "numConjuntos": 2,
    "numAnuncios": 4,
    "kpis": [
      "CTR esperado: X%-Y% (benchmark Colombia para este nicho)",
      "CPM: $X.XXX-$X.XXX COP",
      "Métrica específica del objetivo principal con valor estimado"
    ],
    "recomendaciones": [
      "Recomendación accionable y específica para este cliente #1",
      "Recomendación accionable y específica #2",
      "Recomendación accionable y específica #3"
    ]
  },
  "paraConfirmar": [
    "Solo incluir si hay datos realmente necesarios que no tienes"
  ]
}`;

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

=== INSTRUCCIONES ===
Eres el estratega experto de Meta Ads de Growth Strategy JS. Genera la estrategia completa lista para montar en el Administrador de Anuncios. Toma TODAS las decisiones técnicas (objetivos, presupuestos, audiencias, plataformas, copies) basándote en el kit del cliente y el mercado colombiano.
${JSON_OUTPUT_INSTRUCTION}`;
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
          Copy: ${a.copy || '(sin copy — GENERA TÚ uno específico para este cliente usando el kit)'}
          Plantilla conversación: ${a.tipoPlantilla}${a.plantillaNombre ? ` — "${a.plantillaNombre}"` : ''}
          Saludo: ${a.saludo || '(sin saludo — GENERA TÚ uno personalizado para esta marca)'}
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
Enriquece esta estructura con razonamiento estratégico real. Mantén exactamente la misma cantidad de campañas/conjuntos/anuncios. Para copies vacíos, genera copies específicos con el kit del cliente. Para saludos vacíos, genera mensajes personalizados.
${JSON_OUTPUT_INSTRUCTION}`;
}

const IMAGE_SYSTEM_PREFIX = `Eres un estratega experto de Meta Ads para el mercado colombiano, trabajando para la agencia Growth Strategy JS.`;

export function buildImagePrompt(contextNote: string, kit: BrandKit | null): string {
  const kitSection = kit
    ? `\nCLIENTE: ${kit.name}\nVoz: ${kit.voice || 'no definida'}\nDiferenciadores: ${kit.differentiators || 'no definidos'}\nAudiencias: ${kit.audiences || 'no definidas'}`
    : '';

  return `${IMAGE_SYSTEM_PREFIX}${kitSection}

Analiza la imagen adjunta (mapa mental, pizarrón o captura de estrategia de Meta Ads).

Instrucciones:
1. Extrae TODA la información visible: campañas, objetivos, conjuntos, anuncios, audiencias, presupuestos, plataformas
2. Interpreta texto parcialmente legible usando contexto de Meta Ads colombiano
3. Para copies: si el kit tiene datos del cliente, genera copies específicos para esa marca; nunca uses placeholders
4. Completa con criterio estratégico lo que la imagen no muestre claramente

${contextNote ? `CONTEXTO DEL USUARIO: ${contextNote}\n` : ''}
${JSON_OUTPUT_INSTRUCTION}`;
}

export function buildTranscriptPrompt(
  transcripcion: string,
  kit: BrandKit | null,
  knowledge: ToolKnowledgeBase | null,
): string {
  const kitSection = kit
    ? `CLIENTE: ${kit.name} — Voz: ${kit.voice || 'N/D'} — Diferenciadores: ${kit.differentiators || 'N/D'} — Audiencias: ${kit.audiences || 'N/D'}`
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
2. Asigna valores a todos los campos: objetivo, presupuesto, conjuntos, anuncios, audiencias, plataformas
3. Para copies vacíos o incompletos: genera copies específicos con el kit del cliente (nunca placeholders)
4. Agrega razonamiento estratégico conciso donde sea útil

${JSON_OUTPUT_INSTRUCTION}`;
}
