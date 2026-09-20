/**
 * Utilidades geométricas y de formato del renderer SVG de planos. Puras e
 * isomorfas (las usa el servidor para rasterizar y el cliente para previsualizar).
 * Todas las coordenadas están en MILÍMETROS del plano; el SVG usa el mismo
 * espacio vía viewBox.
 */
import type { PlanPoint } from '@/lib/contracts';

export type Pt = PlanPoint;

/** Vector unitario de a → b; null si los puntos coinciden. */
export function direction(a: Pt, b: Pt): Pt | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  return { x: dx / len, y: dy / len };
}

/** Normal unitaria (perpendicular) de un vector unitario. */
export function normal(dir: Pt): Pt {
  return { x: -dir.y, y: dir.x };
}

export function add(a: Pt, b: Pt, scale = 1): Pt {
  return { x: a.x + b.x * scale, y: a.y + b.y * scale };
}

export function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function distance(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Centroide simple (media de vértices). */
export function centroid(points: Pt[]): Pt {
  const n = Math.max(1, points.length);
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / n, y: sum.y / n };
}

/** Área de un polígono (shoelace), en las unidades² de entrada. */
export function polygonArea(points: Pt[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Número compacto para atributos SVG (décimas de mm bastan). */
export function fmt(n: number): string {
  return String(Math.round(n * 10) / 10);
}

export function fmtPt(p: Pt): string {
  return `${fmt(p.x)},${fmt(p.y)}`;
}

/** Escapa texto para contenido/atributos XML. */
export function escapeXml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
