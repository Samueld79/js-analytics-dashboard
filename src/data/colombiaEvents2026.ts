export type ColombiaEvent = {
  date: string;
  name: string;
  type: 'festivo' | 'comercial';
  emoji: string;
};

export const colombiaEvents2026: ColombiaEvent[] = [
  // ── Festivos oficiales ────────────────────────────────────────────────────
  { date: '2026-01-01', name: 'Año Nuevo',                    type: 'festivo',   emoji: '🎆' },
  { date: '2026-01-12', name: 'Reyes Magos',                  type: 'festivo',   emoji: '👑' },
  { date: '2026-03-23', name: 'Día de San José',              type: 'festivo',   emoji: '📅' },
  { date: '2026-04-02', name: 'Jueves Santo',                 type: 'festivo',   emoji: '✝️' },
  { date: '2026-04-03', name: 'Viernes Santo',                type: 'festivo',   emoji: '✝️' },
  { date: '2026-05-01', name: 'Día del Trabajo',              type: 'festivo',   emoji: '👷' },
  { date: '2026-05-18', name: 'Ascensión del Señor',          type: 'festivo',   emoji: '📅' },
  { date: '2026-06-08', name: 'Corpus Christi',               type: 'festivo',   emoji: '📅' },
  { date: '2026-06-15', name: 'Sagrado Corazón',              type: 'festivo',   emoji: '📅' },
  { date: '2026-06-29', name: 'San Pedro y San Pablo',        type: 'festivo',   emoji: '📅' },
  { date: '2026-07-20', name: 'Independencia de Colombia',    type: 'festivo',   emoji: '🇨🇴' },
  { date: '2026-08-07', name: 'Batalla de Boyacá',            type: 'festivo',   emoji: '🇨🇴' },
  { date: '2026-08-17', name: 'Asunción de la Virgen',        type: 'festivo',   emoji: '📅' },
  { date: '2026-10-12', name: 'Día de la Raza',               type: 'festivo',   emoji: '📅' },
  { date: '2026-11-02', name: 'Todos los Santos',             type: 'festivo',   emoji: '📅' },
  { date: '2026-11-16', name: 'Independencia de Cartagena',   type: 'festivo',   emoji: '🇨🇴' },
  { date: '2026-12-08', name: 'Inmaculada Concepción',        type: 'festivo',   emoji: '📅' },
  { date: '2026-12-25', name: 'Navidad',                      type: 'festivo',   emoji: '🎄' },

  // ── Fechas comerciales ────────────────────────────────────────────────────
  { date: '2026-01-06', name: 'Rebajas de Enero',             type: 'comercial', emoji: '🛍️' },
  { date: '2026-02-14', name: 'San Valentín',                 type: 'comercial', emoji: '💝' },
  { date: '2026-03-08', name: 'Día de la Mujer',              type: 'comercial', emoji: '💜' },
  { date: '2026-03-17', name: 'Día de San Patricio',          type: 'comercial', emoji: '🍀' },
  { date: '2026-04-19', name: 'Día del Niño',                 type: 'comercial', emoji: '🧒' },
  { date: '2026-04-22', name: 'Día de la Tierra',             type: 'comercial', emoji: '🌍' },
  { date: '2026-04-26', name: 'Día de la Secretaria',         type: 'comercial', emoji: '💼' },
  { date: '2026-05-10', name: 'Día de la Madre',              type: 'comercial', emoji: '💐' },
  { date: '2026-05-15', name: 'Día del Maestro',              type: 'comercial', emoji: '🎓' },
  { date: '2026-06-05', name: 'Día del Medio Ambiente',       type: 'comercial', emoji: '🌿' },
  { date: '2026-06-21', name: 'Día del Padre',                type: 'comercial', emoji: '👔' },
  { date: '2026-09-18', name: 'Amor y Amistad',               type: 'comercial', emoji: '💛' },
  { date: '2026-10-31', name: 'Halloween',                    type: 'comercial', emoji: '🎃' },
  { date: '2026-11-07', name: 'Anticipo Velitas',             type: 'comercial', emoji: '🕯️' },
  { date: '2026-11-11', name: 'Día de las Velitas',           type: 'comercial', emoji: '🕯️' },
  { date: '2026-11-17', name: 'Cyber Day Colombia',           type: 'comercial', emoji: '💻' },
  { date: '2026-11-27', name: 'Black Friday',                 type: 'comercial', emoji: '🛍️' },
  { date: '2026-12-01', name: 'Cyber Monday',                 type: 'comercial', emoji: '💻' },
  { date: '2026-12-07', name: 'Noche de Velitas',             type: 'comercial', emoji: '🕯️' },
  { date: '2026-12-16', name: 'Inicio Novenas',               type: 'comercial', emoji: '🎅' },
  { date: '2026-12-24', name: 'Nochebuena',                   type: 'comercial', emoji: '🎄' },
  { date: '2026-12-31', name: 'Año Viejo',                    type: 'comercial', emoji: '🎆' },
];
