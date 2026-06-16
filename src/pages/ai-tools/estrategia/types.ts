export type CampaignObjective =
  | 'Reconocimiento'
  | 'Tráfico'
  | 'Interacción'
  | 'Clientes potenciales'
  | 'Ventas';

export type BudgetType = 'ABO' | 'CBO';

export type Ad = {
  id: string;
  tipo: 'nuevo' | 'existente';
  url: string;
  formato: string;
  angulo: string;
  copy: string;
  multiAnunciante: boolean;
  tipoPlantilla: string;
  plantillaNombre: string;
  saludo: string;
  pregunta1: string;
  pregunta2: string;
  pregunta3: string;
};

export type AdSetPlataformas = {
  facebook: boolean;
  instagram: boolean;
  messenger: boolean;
  audienceNetwork: boolean;
  threads: boolean;
};

export type AdSet = {
  id: string;
  nombre: string;
  ubicacionConversion: string;
  tipoInteraccion: string;
  objetivoRendimiento: string;
  lugares: string;
  advantagePlus: boolean;
  edadMin: number;
  edadMax: number;
  edadMaxPlus: boolean;
  genero: string;
  excluirPublicos: string;
  incluirPublicos: string[];
  otrosPublicos: string;
  plataformas: AdSetPlataformas;
  presupuesto: number;
  anuncios: Ad[];
};

export type Campaign = {
  id: string;
  nombre: string;
  objetivo: CampaignObjective;
  tipoPresupuesto: BudgetType;
  presupuesto: number;
  conjuntos: AdSet[];
};

// ─── Options ────────────────────────────────────────────────────────────────

export const PERFORMANCE_OPTIONS: Record<CampaignObjective, string[]> = {
  Reconocimiento: [
    'Maximizar alcance de anuncios',
    'Maximizar número de impresiones',
    'Maximizar mejora de recuerdo del anuncio',
    'Maximizar reproducciones ThruPlay',
    'Maximizar reproducciones de video continuas de 2 segundos',
  ],
  Tráfico: [
    'Maximizar visitas a página de destino',
    'Maximizar clics en enlace',
    'Maximizar alcance diario único',
    'Maximizar conversaciones',
    'Maximizar impresiones',
  ],
  Interacción: [
    'Maximizar reproducciones ThruPlay',
    'Maximizar reproducciones de video continuas de 2 segundos',
  ],
  'Clientes potenciales': [
    'Maximizar conversiones',
    'Maximizar visitas a página de destino',
    'Maximizar clics en enlace',
    'Maximizar alcance diario único',
    'Maximizar impresiones',
  ],
  Ventas: [
    'Maximizar conversiones (recomendado)',
    'Maximizar valor de conversiones',
    'Maximizar visitas a página de destino',
    'Maximizar clics en enlace',
    'Maximizar alcance diario único',
    'Maximizar impresiones',
  ],
};

export const UBICACION_OPTIONS: Record<CampaignObjective, string[]> = {
  Reconocimiento: [],
  Tráfico: [
    'Sitio web',
    'Destinos de mensajes (Messenger / Instagram / WhatsApp)',
    'Instagram o Facebook',
    'Llamadas',
  ],
  Interacción: [
    'Destinos de mensajes',
    'En tu anuncio',
    'Llamadas',
    'Sitio web',
    'Instagram o Facebook',
  ],
  'Clientes potenciales': [
    'Sitio web',
    'Formularios instantáneos',
    'Messenger',
    'Instagram',
    'WhatsApp',
    'Llamadas',
    'Varias (Sitio web + formularios)',
    'Varias (Sitio web + llamadas)',
    'Varias (Formularios + Messenger)',
  ],
  Ventas: [
    'Sitio web',
    'Destinos de mensajes',
    'Llamadas',
    'Varias (Sitio web + app)',
    'Varias (Sitio web + negocio)',
    'Varias (Sitio web + app + negocio)',
    'Varias (Sitio web + llamadas)',
  ],
};

export const TIPO_INTERACCION_OPTIONS = [
  'Interacciones',
  'Reproducciones de video',
  'Respuestas a eventos',
];

export const ENGAGEMENT_PUBLICOS = [
  'Interactuaron con página de Facebook (365 días)',
  'Interactuaron con perfil de Instagram (365 días)',
  'Vieron video al 25%',
  'Vieron video al 50%',
  'Vieron video al 75%',
  'Vieron video al 95%',
];

export const TRAFFIC_PUBLICOS = [
  'Visitaron el sitio web (180 días)',
  'Lista de clientes (subida manualmente)',
  'Lookalike 1% de compradores',
  'Lookalike 1-3% de compradores',
];

export const AD_FORMATOS = ['Video Reel', 'Video Story', 'Imagen estática', 'Carrusel'];

export const AD_ANGULOS = [
  'TOFU — Reconocimiento / Educativo',
  'MOFU — Consideración / Testimonial',
  'BOFU — Cierre / Urgencia / UGC',
];

export const TIPO_PLANTILLA_OPTIONS = [
  'Plantilla sugerida por Meta',
  'Plantilla guardada (especificar nombre)',
  'Configuración personalizada',
];

export const CAMPAIGN_OBJECTIVES: CampaignObjective[] = [
  'Reconocimiento',
  'Tráfico',
  'Interacción',
  'Clientes potenciales',
  'Ventas',
];

// ─── Factories ───────────────────────────────────────────────────────────────

export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function createEmptyAd(): Ad {
  return {
    id: uid(),
    tipo: 'nuevo',
    url: '',
    formato: 'Video Reel',
    angulo: 'TOFU — Reconocimiento / Educativo',
    copy: '',
    multiAnunciante: false,
    tipoPlantilla: 'Plantilla sugerida por Meta',
    plantillaNombre: '',
    saludo: '',
    pregunta1: '',
    pregunta2: '',
    pregunta3: '',
  };
}

export function createEmptyAdSet(): AdSet {
  return {
    id: uid(),
    nombre: '',
    ubicacionConversion: '',
    tipoInteraccion: '',
    objetivoRendimiento: '',
    lugares: '',
    advantagePlus: false,
    edadMin: 18,
    edadMax: 65,
    edadMaxPlus: false,
    genero: 'Todos',
    excluirPublicos: '',
    incluirPublicos: [],
    otrosPublicos: '',
    plataformas: {
      facebook: true,
      instagram: true,
      messenger: false,
      audienceNetwork: false,
      threads: false,
    },
    presupuesto: 0,
    anuncios: [createEmptyAd()],
  };
}

export function createEmptyCampaign(): Campaign {
  return {
    id: uid(),
    nombre: '',
    objetivo: 'Tráfico',
    tipoPresupuesto: 'ABO',
    presupuesto: 0,
    conjuntos: [createEmptyAdSet()],
  };
}
