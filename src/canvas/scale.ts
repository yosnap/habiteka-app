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
import type { CanvasScale } from './types';

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
 * Medida real de un objeto ("4 m × 80 cm") según la escala, respetando su
 * rotación: rotado 90° intercambia ancho y alto. Compartido por la toolbar y el
 * prompt para que ambos muestren lo mismo.
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
