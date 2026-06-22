/**
 * Helpers de las luces de primera clase (F-LUZ). Lógica PURA, sin Konva ni React.
 *
 * Una luz es un objeto del catálogo (kind `foco`) con atributos `light` (color e
 * intensidad). Estas funciones derivan el valor por defecto, describen la luz en
 * lenguaje natural para el prompt del render, y normalizan datos de entrada.
 */
import type { LightProps, StructKind } from './types';

/** Kinds que son una luz de primera clase (llevan atributos `light`). */
const LIGHT_KINDS: ReadonlySet<StructKind> = new Set<StructKind>(['foco']);

/** ¿El kind es una luz de primera clase? */
export function isLight(kind: StructKind): boolean {
  return LIGHT_KINDS.has(kind);
}

/** Luz por defecto al crear un foco: cálida, intensidad media. */
export function defaultLight(): LightProps {
  return { color: '#ffd9a0', intensidad: 60 };
}

/** Acota la intensidad al rango válido 0–100. */
export function clampIntensity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Etiqueta de temperatura/ambiente a partir del color (para describir la luz). */
function temperatureLabel(color: string): string {
  // Heurística simple sobre el hex: más rojo que azul ⇒ cálida; al revés ⇒ fría.
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color.trim());
  if (!m) return 'neutra';
  const r = parseInt(m[1]!, 16);
  const b = parseInt(m[3]!, 16);
  if (r - b > 30) return 'cálida';
  if (b - r > 30) return 'fría';
  return 'neutra';
}

/** Nivel de intensidad legible para el prompt. */
function intensityLabel(intensidad: number): string {
  if (intensidad < 33) return 'tenue';
  if (intensidad > 66) return 'intensa';
  return 'media';
}

/** Describe una luz para el prompt del render ("luz cálida intensa"). */
export function describeLight(props: LightProps): string {
  return `luz ${temperatureLabel(props.color)} ${intensityLabel(props.intensidad)}`;
}
