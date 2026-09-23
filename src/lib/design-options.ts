/**
 * Fuente ÚNICA de las opciones de interacción del producto (estilos, entregables).
 *
 * El chat y el formulario del plano comparten estas listas: cambiar o añadir una
 * opción aquí se propaga a todos los puntos sin duplicar (principio de un solo
 * sitio de verdad). Los *tipos* viven en `contracts/` (que es solo tipos); este
 * módulo aporta los DATOS (valor + etiqueta para la UI).
 *
 * Escalabilidad: los labels se declaran como `Record<Estilo, ...>`, así el
 * compilador OBLIGA a dar etiqueta a cada valor nuevo del tipo — añadir un estilo
 * sin su label es un error de compilación, no un olvido en runtime.
 */
import type { Estilo, DeliverableType } from './contracts';

export interface Option<T extends string> {
  value: T;
  label: string;
}

/** Opción de estilo con su miniatura realista (selector visual tipo Planner5D). */
export interface EstiloOption extends Option<Estilo> {
  image: string;
}

// Etiquetas en español. `Record<Estilo, string>` fuerza exhaustividad: si se añade
// un `Estilo` al tipo y no se le pone etiqueta aquí, el build falla.
const ESTILO_LABELS: Record<Estilo, string> = {
  minimalista: 'Minimalista',
  moderno: 'Moderno',
  clasico: 'Clásico',
  industrial: 'Industrial',
  rustico: 'Rústico',
  mediterraneo: 'Mediterráneo',
  nordico: 'Nórdico',
  japandi: 'Japandi',
  boho: 'Bohemio',
  midcentury: 'Mid-century',
  costero: 'Costero',
  contemporaneo: 'Contemporáneo',
  escandinavo: 'Escandinavo',
  artdeco: 'Art Déco',
  tropical: 'Tropical',
};

// Descripción breve de cada estilo, para explicar al usuario qué va a recibir cuando
// lo selecciona en la galería. `Record<Estilo, string>` fuerza exhaustividad igual que
// las etiquetas: un estilo nuevo sin descripción rompe el build.
const ESTILO_DESCRIPCIONES: Record<Estilo, string> = {
  minimalista: 'Pocas piezas, líneas limpias y mucho espacio libre. Paleta neutra y orden visual.',
  moderno: 'Formas actuales, materiales mixtos y contrastes suaves. Práctico y sin recargar.',
  clasico: 'Maderas nobles, simetría y textiles cuidados. Un ambiente atemporal y acogedor.',
  industrial: 'Ladrillo, metal negro y hormigón vistos. Aire de loft urbano y techos altos.',
  rustico: 'Madera envejecida, piedra y tejidos naturales. Calidez de casa de campo.',
  mediterraneo: 'Blancos encalados, azules y cerámica artesanal. Luz y frescor del sur.',
  nordico: 'Madera clara, blanco y textiles suaves. Luminoso y muy funcional.',
  japandi: 'Mezcla japonesa y nórdica: madera natural, líneas bajas y calma.',
  boho: 'Fibras naturales, estampados y plantas. Relajado, con mezcla de piezas.',
  midcentury: 'Muebles de los años 50-60: patas finas, maderas cálidas y colores mostaza o verde.',
  costero: 'Tonos arena y azul, madera clara y fibras. Ambiente de casa junto al mar.',
  contemporaneo: 'Lo que se lleva ahora: neutros elegantes, formas suaves y detalles de diseño.',
  escandinavo: 'Sencillez nórdica llevada al máximo: blancos, madera y confort.',
  artdeco: 'Geometría, latón, terciopelo y espejos. Elegante y con carácter.',
  tropical: 'Verdes intensos, ratán y plantas grandes. Fresco y exuberante.',
};

const ENTREGABLE_LABELS: Record<DeliverableType, string> = {
  plano2d: 'Plano 2D',
  render3d: 'Render 3D',
  memoria: 'Memoria de materiales',
};

/**
 * Estilos como lista de opciones {value,label,image} para la UI. La miniatura es una
 * foto realista de un salón en ese estilo (en `public/styles/<slug>.webp`), para un
 * selector visual tipo Planner5D. El nombre del archivo = el slug del estilo.
 */
export const ESTILOS: ReadonlyArray<EstiloOption> = (
  Object.keys(ESTILO_LABELS) as Estilo[]
).map((value) => ({ value, label: ESTILO_LABELS[value], image: `/styles/${value}.webp` }));

/** Entregables como lista de opciones {value,label} para la UI. */
export const ENTREGABLES: ReadonlyArray<Option<DeliverableType>> = (
  Object.keys(ENTREGABLE_LABELS) as DeliverableType[]
).map((value) => ({ value, label: ENTREGABLE_LABELS[value] }));

/** Solo los valores (para enums de herramientas y validación). */
export const ESTILO_VALUES: ReadonlyArray<Estilo> = ESTILOS.map((o) => o.value);
export const ENTREGABLE_VALUES: ReadonlyArray<DeliverableType> = ENTREGABLES.map((o) => o.value);

export function isValidEstilo(v: unknown): v is Estilo {
  return typeof v === 'string' && (ESTILO_VALUES as readonly string[]).includes(v);
}

/**
 * Etiqueta legible de un estilo (p. ej. `midcentury` → "Mid-century"). Útil para los
 * prompts de IA: el label se entiende mejor que el slug. Si el valor no es un estilo
 * conocido se devuelve tal cual (no se pierde la intención del usuario).
 */
export function estiloLabel(estilo: string): string {
  return isValidEstilo(estilo) ? ESTILO_LABELS[estilo] : estilo;
}

/** Descripción breve del estilo para la UI ('' si el valor no es un estilo conocido). */
export function estiloDescripcion(estilo: string): string {
  return isValidEstilo(estilo) ? ESTILO_DESCRIPCIONES[estilo] : '';
}

export function isValidEntregable(v: unknown): v is DeliverableType {
  return typeof v === 'string' && (ENTREGABLE_VALUES as readonly string[]).includes(v);
}
