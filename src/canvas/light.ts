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

/**
 * Convierte temperatura de color (Kelvin) a RGB usando una aproximación del locus de Planck.
 * Rango útil: 1000K (rojo vela) – 40000K (azul cielo). Valores típicos: 2700K (cálida),
 * 4000K (neutra), 6500K (fría día). Algoritmo de Tanner Helland (aproximación polinómica).
 * Devuelve { r, g, b } en 0–255.
 */
export function kelvinToRGB(kelvin: number): { r: number; g: number; b: number } {
  const k = Math.min(40000, Math.max(1000, kelvin)) / 100;
  let r: number, g: number, b: number;
  if (k <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(k) - 161.1195681661;
  } else {
    r = 329.698727446 * Math.pow(k - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(k - 60, -0.0755148492);
  }
  if (k >= 66) {
    b = 255;
  } else if (k <= 19) {
    b = 0;
  } else {
    b = 138.5177312231 * Math.log(k - 10) - 305.0447927307;
  }
  return {
    r: Math.min(255, Math.max(0, r)),
    g: Math.min(255, Math.max(0, g)),
    b: Math.min(255, Math.max(0, b)),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Color efectivo de una luz para el render 3D: si tiene `temperature` (K), usa kelvinToRGB
 * (más realista); si no, usa el `color` hex manual. Si `on === false`, devuelve null (apagada).
 */
export function lightColor(props: LightProps): string | null {
  if (props.on === false) return null;
  if (typeof props.temperature === 'number' && Number.isFinite(props.temperature)) {
    const { r, g, b } = kelvinToRGB(props.temperature);
    return rgbToHex(r, g, b);
  }
  return props.color;
}
