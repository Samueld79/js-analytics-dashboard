export type FieldType = 'select' | 'textarea' | 'input' | 'number';

export type ToolField = {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  rows?: number;
};

export type ToolMode = {
  key: string;
  label: string;
  fields: ToolField[];
  hasImage?: boolean;
  imageLabel?: string;
  outputInstructions: string;
};

export type ToolConfig = {
  key: string;
  title: string;
  emoji: string;
  description: string;
  section: 'estrategia' | 'creacion' | 'video_analisis';
  fields?: ToolField[];
  modes?: ToolMode[];
  hasImage?: boolean;
  imageLabel?: string;
  outputInstructions?: string;
};

const SYSTEM_PROMPT =
  'Eres un estratega experto de Meta Ads para el mercado colombiano, trabajando para la agencia Growth Strategy JS. Respondes siempre en español colombiano, en formato Markdown limpio, directo y accionable, sin relleno ni introducciones largas.';

export const SYSTEM_PROMPT_AI = SYSTEM_PROMPT;

export const TOOL_CONFIGS: ToolConfig[] = [
  {
    key: 'ideas',
    title: 'Ideas de Anuncios',
    emoji: '💡',
    description: 'Genera ideas creativas de anuncios basadas en el kit de marca y ángulos probados.',
    section: 'estrategia',
    fields: [
      {
        key: 'objetivo',
        label: 'Objetivo de campaña',
        type: 'select',
        options: ['Reconocimiento', 'Tráfico', 'Mensajes', 'Leads', 'Ventas', 'Interacción'],
        required: true,
      },
      {
        key: 'producto',
        label: 'Producto o servicio a anunciar',
        type: 'textarea',
        placeholder: 'Describe brevemente qué se va a anunciar...',
        rows: 3,
        required: true,
      },
      {
        key: 'publico',
        label: 'Público objetivo',
        type: 'textarea',
        placeholder: 'Edad, género, intereses, situación de vida...',
        rows: 3,
      },
      {
        key: 'num_ideas',
        label: 'Número de ideas',
        type: 'select',
        options: ['3', '5', '7', '10'],
      },
      {
        key: 'contexto',
        label: 'Contexto adicional (opcional)',
        type: 'textarea',
        placeholder: 'Temporada, evento, restricciones creativas...',
        rows: 2,
      },
    ],
    outputInstructions:
      'Genera ideas de anuncios para Meta. Cada idea debe incluir: ÁNGULO DE VENTA, HOOK (primera línea del copy), COPY PRINCIPAL (2-3 oraciones), FORMATO RECOMENDADO (imagen estática, carrusel, reel, video), y CTA. Separa cada idea con un encabezado numerado. Prioriza ángulos no saturados, emocionales y específicos para el mercado colombiano.',
  },
  {
    key: 'estrategia',
    title: 'Estrategia de Ads',
    emoji: '🎯',
    description: 'Construye una estrategia completa de Meta Ads desde un formulario, imagen o transcripción.',
    section: 'estrategia',
    modes: [
      {
        key: 'formulario',
        label: 'Formulario',
        fields: [
          {
            key: 'objetivo',
            label: 'Objetivo principal',
            type: 'select',
            options: ['Reconocimiento', 'Tráfico', 'Mensajes', 'Leads', 'Ventas', 'Interacción'],
            required: true,
          },
          {
            key: 'presupuesto',
            label: 'Presupuesto mensual (COP)',
            type: 'input',
            placeholder: 'Ej: 500000',
            required: true,
          },
          {
            key: 'duracion',
            label: 'Duración de la campaña',
            type: 'select',
            options: ['1 semana', '2 semanas', '1 mes', '2 meses', '3 meses'],
          },
          {
            key: 'contexto',
            label: 'Contexto y situación actual',
            type: 'textarea',
            placeholder: 'Situación del negocio, campañas anteriores, resultados recientes...',
            rows: 4,
            required: true,
          },
          {
            key: 'restricciones',
            label: 'Restricciones o consideraciones',
            type: 'textarea',
            placeholder: 'Exclusiones de público, temas sensibles, competencia directa...',
            rows: 2,
          },
        ],
        outputInstructions:
          'Crea una estrategia completa de Meta Ads con: 1) DIAGNÓSTICO Y OPORTUNIDAD, 2) ESTRUCTURA DE CAMPAÑA (campañas, conjuntos, anuncios recomendados), 3) SEGMENTACIÓN DETALLADA (audiencias frías, tibias, calientes), 4) DISTRIBUCIÓN DE PRESUPUESTO (porcentajes por etapa del funnel), 5) CREATIVOS RECOMENDADOS (formatos, mensajes clave), 6) MÉTRICAS A MONITOREAR y benchmarks esperados, 7) CRONOGRAMA DE ACCIONES.',
      },
      {
        key: 'imagen',
        label: 'Desde Imagen',
        hasImage: true,
        imageLabel: 'Sube captura del Manager de Meta Ads',
        fields: [
          {
            key: 'pregunta',
            label: '¿Qué quieres analizar o mejorar?',
            type: 'textarea',
            placeholder: 'Describe tu situación o pregunta específica sobre los resultados...',
            rows: 3,
          },
        ],
        outputInstructions:
          'Analiza la captura del Manager de Meta Ads y proporciona: 1) DIAGNÓSTICO de los resultados actuales, 2) PROBLEMAS IDENTIFICADOS (qué no está funcionando y por qué), 3) OPORTUNIDADES DE MEJORA priorizadas, 4) PLAN DE ACCIÓN concreto con pasos específicos, 5) MÉTRICAS A OPTIMIZAR y metas realistas. Sé específico con los números que ves en la imagen.',
      },
      {
        key: 'transcripcion',
        label: 'Desde Texto',
        fields: [
          {
            key: 'transcripcion',
            label: 'Transcripción o notas de reunión',
            type: 'textarea',
            placeholder: 'Pega aquí el texto de la reunión, notas, o briefing del cliente...',
            rows: 10,
            required: true,
          },
        ],
        outputInstructions:
          'A partir de las notas o transcripción, extrae y estructura una estrategia de Meta Ads: 1) RESUMEN DEL BRIEFING (qué quiere el cliente), 2) OBJETIVOS IDENTIFICADOS, 3) ESTRATEGIA RECOMENDADA con estructura de campaña, 4) PRÓXIMOS PASOS y entregables, 5) PREGUNTAS PENDIENTES que faltan aclarar.',
      },
    ],
  },
  {
    key: 'mercado',
    title: 'Investigador de Mercado',
    emoji: '🔍',
    description: 'Analiza el mercado, competencia y oportunidades para el cliente.',
    section: 'estrategia',
    fields: [
      {
        key: 'industria',
        label: 'Industria o nicho',
        type: 'input',
        placeholder: 'Ej: Joyería artesanal, Ropa deportiva femenina...',
        required: true,
      },
      {
        key: 'competidores',
        label: 'Competidores principales (opcional)',
        type: 'textarea',
        placeholder: 'Nombres de marcas o negocios similares...',
        rows: 2,
      },
      {
        key: 'propuesta',
        label: 'Propuesta de valor actual',
        type: 'textarea',
        placeholder: '¿Qué ofrece el cliente que lo diferencia hoy?',
        rows: 3,
      },
      {
        key: 'pregunta',
        label: 'Pregunta específica de investigación',
        type: 'textarea',
        placeholder: '¿Qué quieres saber sobre el mercado? Ej: ¿A qué segmento le funciona mejor el carrusel?',
        rows: 3,
        required: true,
      },
    ],
    outputInstructions:
      'Realiza un análisis de mercado con: 1) PANORAMA DEL MERCADO en Colombia (tendencias, tamaño, oportunidades), 2) ANÁLISIS DE COMPETIDORES (fortalezas y debilidades comunes del segmento), 3) SEGMENTOS DE AUDIENCIA más rentables para este nicho en Meta, 4) ÁNGULOS Y MENSAJES que funcionan en esta industria, 5) RECOMENDACIONES ESTRATÉGICAS específicas, 6) RESPUESTA a la pregunta específica planteada.',
  },
  {
    key: 'oferta',
    title: 'Creador de Oferta',
    emoji: '🎁',
    description: 'Construye una oferta irresistible con copy persuasivo para anuncios.',
    section: 'creacion',
    fields: [
      {
        key: 'producto',
        label: 'Producto o servicio',
        type: 'input',
        placeholder: 'Nombre del producto/servicio',
        required: true,
      },
      {
        key: 'precio',
        label: 'Precio (COP)',
        type: 'input',
        placeholder: 'Ej: 150000',
      },
      {
        key: 'dolor',
        label: 'Dolor principal que resuelve',
        type: 'textarea',
        placeholder: '¿Cuál es el problema más grande que soluciona?',
        rows: 3,
        required: true,
      },
      {
        key: 'diferenciador',
        label: 'Diferenciador clave',
        type: 'input',
        placeholder: '¿Qué lo hace único vs la competencia?',
      },
      {
        key: 'garantia',
        label: 'Garantía o promesa',
        type: 'input',
        placeholder: 'Ej: Devolución en 30 días, resultado garantizado...',
      },
      {
        key: 'formato',
        label: 'Formato de salida',
        type: 'select',
        options: ['Copy para anuncio', 'Propuesta completa de oferta', 'Ambos'],
      },
    ],
    outputInstructions:
      'Crea una oferta irresistible con: 1) TITULAR PRINCIPAL (hook que detiene el scroll), 2) PROPUESTA DE VALOR CLARA (qué, para quién, resultado esperado), 3) STACK DE VALOR (lista de lo que incluye con valor percibido de cada ítem), 4) ELIMINACIÓN DE RIESGO (garantía redactada de forma persuasiva), 5) URGENCIA O ESCASEZ (si aplica), 6) CTA ESPECÍFICO y contundente. Luego escribe 3 variaciones de copy para anuncio usando esta oferta.',
  },
  {
    key: 'carrusel',
    title: 'Carrusel Copy',
    emoji: '📱',
    description: 'Genera el copy completo para cada slide de un carrusel de Meta.',
    section: 'creacion',
    fields: [
      {
        key: 'tema',
        label: 'Tema del carrusel',
        type: 'input',
        placeholder: 'Ej: Los 5 errores que cometes al elegir aretes...',
        required: true,
      },
      {
        key: 'objetivo_carrusel',
        label: 'Objetivo del carrusel',
        type: 'select',
        options: ['Educar', 'Inspirar', 'Vender', 'Generar engagement', 'Posicionamiento'],
        required: true,
      },
      {
        key: 'num_slides',
        label: 'Número de slides',
        type: 'select',
        options: ['5', '6', '7', '8', '10'],
      },
      {
        key: 'cta',
        label: 'CTA del último slide',
        type: 'input',
        placeholder: 'Ej: Escríbenos ahora, Ver el catálogo...',
      },
      {
        key: 'tono_carrusel',
        label: 'Tono',
        type: 'select',
        options: ['Educativo', 'Cercano y conversacional', 'Aspiracional', 'Urgente', 'Humorístico'],
      },
    ],
    outputInstructions:
      'Crea el copy completo para cada slide del carrusel. Para CADA SLIDE incluye: TÍTULO (máx 30 chars, bold), SUBTÍTULO o copy (máx 90 chars), y ELEMENTO VISUAL SUGERIDO (qué mostrar en la imagen/video del slide). El primer slide debe ser un hook irresistible. El último slide debe tener el CTA. Formato: ## Slide 1: [título] seguido de los elementos.',
  },
  {
    key: 'dm',
    title: 'Mensajes DM',
    emoji: '💬',
    description: 'Crea secuencias de mensajes DM para convertir leads en clientes.',
    section: 'creacion',
    fields: [
      {
        key: 'contexto_dm',
        label: '¿Qué acción tomó el lead?',
        type: 'select',
        options: [
          'Comentó en el anuncio',
          'Reaccionó al anuncio',
          'Envió un DM espontáneo',
          'Hizo clic pero no escribió',
          'Pidió más información',
          'Preguntó el precio',
        ],
        required: true,
      },
      {
        key: 'objetivo_dm',
        label: 'Objetivo de la conversación',
        type: 'select',
        options: ['Agendar llamada/videollamada', 'Enviar precio y cerrar', 'Dar información y nutrir', 'Cerrar venta directa'],
        required: true,
      },
      {
        key: 'tono',
        label: 'Tono de comunicación',
        type: 'select',
        options: ['Profesional', 'Cercano y amigable', 'Consultivo', 'Urgente y directo'],
      },
      {
        key: 'num_mensajes',
        label: 'Secuencia',
        type: 'select',
        options: ['1 mensaje inicial', '3 mensajes de seguimiento', 'Secuencia completa (5-7 mensajes)'],
      },
      {
        key: 'objecion',
        label: 'Objeción principal a manejar (opcional)',
        type: 'input',
        placeholder: 'Ej: "está muy caro", "lo voy a pensar"...',
      },
    ],
    outputInstructions:
      'Crea la secuencia de mensajes DM. Cada mensaje debe: usar el tono solicitado, ser conversacional (NO robótico), incluir espacios y emojis estratégicos (máx 2 por mensaje), no sonar como spam, y avanzar hacia el objetivo. Para cada mensaje indica: MOMENTO DE ENVÍO (ej: "Mensaje 1 – Respuesta inmediata"), TEXTO COMPLETO del mensaje, y VARIACIÓN ALTERNATIVA si aplica.',
  },
  {
    key: 'video',
    title: 'Prompt Video',
    emoji: '🎬',
    description: 'Genera el guión y prompt creativo para videos de Meta Ads.',
    section: 'video_analisis',
    fields: [
      {
        key: 'formato',
        label: 'Formato de video',
        type: 'select',
        options: ['Reel 15 segundos', 'Reel 30 segundos', 'Reel 60 segundos', 'Story vertical', 'Video cuadrado'],
        required: true,
      },
      {
        key: 'objetivo_video',
        label: 'Objetivo',
        type: 'select',
        options: ['Reconocimiento de marca', 'Tráfico al sitio', 'Mensajes directos', 'Leads', 'Ventas'],
        required: true,
      },
      {
        key: 'tipo_gancho',
        label: 'Tipo de hook',
        type: 'select',
        options: ['Pregunta provocadora', 'Dato sorprendente', 'Afirmación polémica', 'Historia personal', 'Demostración del producto', 'Antes y después'],
      },
      {
        key: 'escena',
        label: 'Qué mostrar / concepto visual',
        type: 'textarea',
        placeholder: 'Describe el producto, servicio, o escena que quieres mostrar...',
        rows: 3,
        required: true,
      },
      {
        key: 'texto_pantalla',
        label: '¿Debe tener texto en pantalla?',
        type: 'select',
        options: ['Sí, texto principal en pantalla', 'Solo subtítulos', 'No, solo narración', 'Mixto'],
      },
    ],
    outputInstructions:
      'Genera para este video: 1) HOOK (primeros 3 segundos – lo que se ve Y lo que se escucha/lee), 2) DESARROLLO ESCENA A ESCENA (tiempo de cada escena, acción visual, texto en pantalla si aplica, narración/voz en off), 3) CIERRE Y CTA (últimos 3-5 segundos), 4) PROMPT DE DIRECCIÓN (instrucciones para el cliente sobre cómo grabar cada toma), 5) VARIANTE B (versión alternativa del hook). Formato profesional y fácil de ejecutar.',
  },
  {
    key: 'analizar',
    title: 'Analizar Anuncios',
    emoji: '📊',
    description: 'Sube una captura del Manager y obtén análisis experto con recomendaciones.',
    section: 'video_analisis',
    hasImage: true,
    imageLabel: 'Sube captura del Manager de Meta Ads (requerido)',
    fields: [
      {
        key: 'pregunta_analisis',
        label: '¿Qué quieres analizar o mejorar?',
        type: 'textarea',
        placeholder: 'Ej: ¿Por qué el CPM está tan alto? ¿Qué campaña debería escalar?',
        rows: 3,
        required: true,
      },
      {
        key: 'metricas_extra',
        label: 'Datos adicionales (opcional)',
        type: 'textarea',
        placeholder: 'Pega números que no se ven en la captura: presupuesto total, periodo, metas...',
        rows: 2,
      },
    ],
    outputInstructions:
      'Analiza la captura del Manager de Meta Ads y responde con: 1) DIAGNÓSTICO RÁPIDO (qué está pasando en 3-5 puntos), 2) PROBLEMAS CRÍTICOS identificados con explicación del por qué, 3) OPORTUNIDADES DE OPTIMIZACIÓN priorizadas (del impacto más alto al más bajo), 4) PLAN DE ACCIÓN con pasos específicos y orden de ejecución, 5) BENCHMARKS DE REFERENCIA para el mercado colombiano. Sé específico con los números de la imagen.',
  },
];

export const SECTION_LABELS: Record<string, string> = {
  estrategia: '⚡ Estrategia',
  creacion: '✏️ Creación',
  video_analisis: '🎥 Video & Análisis',
};

export function getToolConfig(key: string): ToolConfig | undefined {
  return TOOL_CONFIGS.find((t) => t.key === key);
}
