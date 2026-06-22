/**
 * Escala arquitectónica del plano: conversión entre píxeles de stage y medidas
 * reales (metros). Lógica PURA y testeable, sin dependencias de Konva ni React.
 *
 * La fuente de verdad de la conversión es `pxPerMeter` (cuántos píxeles de stage
 * equivalen a 1 metro real). El `ratio` arquitectónico (50 ⇒ "1:50") es metadato
 * PRESENTACIONAL opcional: no se usa para convertir, así no hay dos verdades que
 * puedan desincronizarse. Internamente se trabaja siempre en metros; el formateo
 * a cm/m es de presentación.
 */
import type { CanvasScale, StructKind, StructObj } from './types';

/** ¿La escala es usable para convertir? Exige `pxPerMeter` positivo y finito. */
export function isValidScale(v: unknown): v is CanvasScale {
  if (typeof v !== 'object' || v === null) return false;
  const pxPerMeter = (v as { pxPerMeter?: unknown }).pxPerMeter;
  return typeof pxPerMeter === 'number' && Number.isFinite(pxPerMeter) && pxPerMeter > 0;
}

/** Convierte una longitud en píxeles de stage a metros reales. */
export function pxToMeters(px: number, scale: CanvasScale): number {
  return px / scale.pxPerMeter;
}

/** Convierte una longitud en metros reales a píxeles de stage. */
export function metersToPx(meters: number, scale: CanvasScale): number {
  return meters * scale.pxPerMeter;
}

/**
 * Formatea una longitud en metros para mostrarla al usuario o describirla a la IA.
 * Bajo 1 m se expresa en centímetros enteros ("90 cm"); a partir de 1 m, en metros
 * con un decimal ("2,5 m"). Evita precisiones falsas que confundirían al modelo.
 */
export function formatLength(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  // El umbral se evalúa sobre los centímetros YA redondeados: así 0,999 m
  // (→ 100 cm) cruza a "1 m" en vez de mostrarse como "100 cm".
  const cm = Math.round(meters * 100);
  if (cm < 100) {
    return `${cm} cm`;
  }
  // Un decimal, sin ceros sobrantes: "2 m" en vez de "2,0 m".
  const rounded = Math.round(meters * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
  return `${text} m`;
}

/**
 * Medida real EN PLANTA de un objeto ("4 m × 80 cm" = largo × fondo) según la
 * escala, respetando su rotación: rotado 90° intercambia largo y fondo. Compartido
 * por la toolbar y el prompt. NO incluye la altura (3ª dimensión); para eso ver
 * `formatObjectSize3d`.
 */
export function formatObjectSize(
  o: { width: number; height: number; rotation: number },
  scale: CanvasScale,
): string {
  const rotated = Math.round(o.rotation) % 180 !== 0;
  const realW = pxToMeters(rotated ? o.height : o.width, scale);
  const realH = pxToMeters(rotated ? o.width : o.height, scale);
  return `${formatLength(realW)} × ${formatLength(realH)}`;
}

/**
 * Medida real en 3D ("4 m × 80 cm × 2,5 m" = largo × fondo × alto): la de planta
 * más la altura vertical efectiva. Es lo que da a la IA el contexto volumétrico.
 */
export function formatObjectSize3d(
  o: Pick<StructObj, 'kind' | 'width' | 'height' | 'rotation' | 'heightM'>,
  scale: CanvasScale,
  ceilingHeightM?: number,
): string {
  const alto = formatLength(effectiveHeightM(o, ceilingHeightM));
  return `${formatObjectSize(o, scale)} × ${alto} (alto)`;
}

/**
 * Deriva una escala a partir de una longitud conocida: el usuario indica que
 * `px` píxeles de stage corresponden a `meters` metros reales (calibración por
 * dimensión conocida). Devuelve null si los datos no permiten una escala válida.
 */
export function deriveScaleFromKnownLength(
  px: number,
  meters: number,
  ratio?: number,
): CanvasScale | null {
  if (!Number.isFinite(px) || !Number.isFinite(meters) || px <= 0 || meters <= 0) {
    return null;
  }
  const pxPerMeter = px / meters;
  const scale: CanvasScale = { pxPerMeter };
  if (typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0) {
    scale.ratio = ratio;
  }
  return scale;
}

/**
 * Píxeles de stage que representan 1 metro real "de papel virtual" a 100 px/m
 * (la referencia de 1:100). Otros ratios escalan proporcionalmente: a 1:50 se ve
 * el doble de grande (más detalle), a 1:1000 diez veces más pequeño.
 */
const PX_PER_METER_AT_1_100 = 100;

/**
 * Deriva una escala USABLE directamente desde un ratio arquitectónico (50 ⇒ 1:50),
 * sin necesidad de calibrar con un objeto. Convierte el ratio a un `pxPerMeter`
 * coherente (la fuente de verdad de la conversión) y conserva el ratio como
 * metadato presentacional. Devuelve null si el ratio no es válido.
 */
export function scaleFromRatio(ratio: number): CanvasScale | null {
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  // A menor ratio (1:50) el plano se dibuja más grande ⇒ más px por metro.
  const pxPerMeter = (PX_PER_METER_AT_1_100 * 100) / ratio;
  return { pxPerMeter, ratio };
}

// --- Altura (3ª dimensión, en metros) ---
// El plano es 2D (largo × fondo). La altura vertical no se dibuja: se modela en
// metros (`StructObj.heightM`, `CanvasDoc.ceilingHeightM`) para dar contexto 3D a
// la IA. Aquí viven los valores por defecto y la resolución de la altura efectiva.

/** Altura de techo estándar si el plano no fija una (metros). */
export const DEFAULT_CEILING_M = 2.5;

/**
 * Altura vertical típica por elemento (metros), usada cuando el objeto no tiene
 * `heightM` propio. Los muros/aperturas usan la altura de techo, no esta tabla.
 */
const TYPICAL_HEIGHT_M: Partial<Record<StructKind, number>> = {
  // Mobiliario
  cama: 0.6,
  sofa: 0.85,
  mesa: 0.75,
  silla: 0.9,
  armario: 2.0,
  estanteria: 1.8,
  mesilla: 0.5,
  // Cocina
  encimera: 0.9,
  isla: 0.9,
  nevera: 1.8,
  horno: 0.9,
  fregadero: 0.9,
  // Sanitarios
  inodoro: 0.4,
  lavabo: 0.85,
  banera: 0.6,
  ducha: 2.0,
  bidet: 0.4,
  // Electrónica / decoración
  tv: 0.7,
  ordenador: 0.5,
  lampara: 1.5,
  planta: 1.0,
  chimenea: 1.2,
  foco: 0.1,
};

/** ¿El elemento toma su altura de la del techo (muros y aperturas)? */
function usaAlturaDeTecho(kind: StructKind): boolean {
  return kind === 'wall' || kind === 'window' || kind === 'door';
}

/**
 * Tamaño en píxeles de stage con el que nace un objeto del catálogo. Con escala
 * activa usa sus MEDIDAS REALES (metros → px), para que sea realista a cualquier
 * escala; sin escala, cae al tamaño en px por defecto del catálogo. Lógica pura.
 */
export function catalogSizePx(
  entry: { defaultWidth: number; defaultHeight: number; realWidthM: number; realDepthM: number },
  scale: CanvasScale | null,
): { w: number; h: number } {
  if (!scale) return { w: entry.defaultWidth, h: entry.defaultHeight };
  return {
    w: Math.max(2, Math.round(metersToPx(entry.realWidthM, scale))),
    h: Math.max(2, Math.round(metersToPx(entry.realDepthM, scale))),
  };
}

/**
 * Altura vertical efectiva de un objeto en metros: su `heightM` si lo tiene; si
 * no, la altura de techo (muros/aperturas) o la típica del elemento. Da a la IA
 * la 3ª dimensión que el plano 2D no contiene.
 */
export function effectiveHeightM(
  obj: Pick<StructObj, 'kind' | 'heightM'>,
  ceilingHeightM: number = DEFAULT_CEILING_M,
): number {
  if (typeof obj.heightM === 'number' && Number.isFinite(obj.heightM) && obj.heightM > 0) {
    return obj.heightM;
  }
  if (usaAlturaDeTecho(obj.kind)) return ceilingHeightM;
  return TYPICAL_HEIGHT_M[obj.kind] ?? 1;
}
