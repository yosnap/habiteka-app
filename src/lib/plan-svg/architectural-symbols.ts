/**
 * Simbología arquitectónica estándar de plano en planta: hueco en el muro,
 * puerta con hoja y arco de barrido (90°), ventana con triple línea (vidrio).
 * Cada función devuelve fragmentos SVG en coordenadas de plano (mm).
 *
 * Convenio de entrada: `a` y `b` son los extremos del hueco SOBRE EL EJE del
 * muro, `n` la normal unitaria del muro y `thicknessMm` su grosor.
 */
import type { PlanSvgTheme } from './plan-svg-theme';
import { add, direction, fmt, fmtPt, type Pt } from './svg-geometry';

/** Rectángulo que "abre" el muro: se pinta con el color de fondo sobre el poché. */
export function apertureGap(a: Pt, b: Pt, n: Pt, thicknessMm: number, background: string): string {
  // Un pelo más ancho que el muro para no dejar rebabas de antialiasing.
  const half = thicknessMm / 2 + 8;
  const corners = [add(a, n, half), add(b, n, half), add(b, n, -half), add(a, n, -half)];
  return `<polygon points="${corners.map(fmtPt).join(' ')}" fill="${background}"/>`;
}

/** Jambas: remates perpendiculares del muro en los bordes del hueco. */
export function jambLines(a: Pt, b: Pt, n: Pt, thicknessMm: number, theme: PlanSvgTheme): string {
  const half = thicknessMm / 2;
  const line = (p: Pt) =>
    `<line x1="${fmt(p.x + n.x * half)}" y1="${fmt(p.y + n.y * half)}" x2="${fmt(p.x - n.x * half)}" y2="${fmt(p.y - n.y * half)}" stroke="${theme.lineColor}" stroke-width="${theme.symbolLineMm}"/>`;
  return line(a) + line(b);
}

/**
 * Puerta: hoja perpendicular al muro desde la bisagra (`a`) y arco de barrido
 * de 90° hasta el otro borde del hueco (`b`). El barrido se dibuja hacia el
 * lado de `n`.
 */
export function doorSymbol(a: Pt, b: Pt, n: Pt, theme: PlanSvgTheme): string {
  const dir = direction(a, b);
  if (!dir) return '';
  const width = Math.hypot(b.x - a.x, b.y - a.y);
  const leafEnd = add(a, n, width);
  // Sentido del arco: de la hoja (leafEnd) al borde del hueco (b), centrado en
  // la bisagra. El sweep correcto es el que recorre el cuadrante corto; con
  // n = perpendicular "positiva" de dir, ese es sweep=1 en el sistema y-abajo
  // del SVG cuando cross(n→dir) es negativo, y sweep=0 en el caso contrario.
  const cross = n.x * dir.y - n.y * dir.x;
  const sweep = cross > 0 ? 0 : 1;
  const leaf = `<line x1="${fmt(a.x)}" y1="${fmt(a.y)}" x2="${fmt(leafEnd.x)}" y2="${fmt(leafEnd.y)}" stroke="${theme.lineColor}" stroke-width="${theme.symbolLineMm}"/>`;
  const arc = `<path d="M ${fmt(leafEnd.x)} ${fmt(leafEnd.y)} A ${fmt(width)} ${fmt(width)} 0 0 ${sweep} ${fmt(b.x)} ${fmt(b.y)}" fill="none" stroke="${theme.lineColor}" stroke-width="${theme.thinLineMm}"/>`;
  return leaf + arc;
}

/** Ventana: triple línea a lo largo del hueco (marco-vidrio-marco). */
export function windowSymbol(a: Pt, b: Pt, n: Pt, thicknessMm: number, theme: PlanSvgTheme): string {
  const offsets = [-thicknessMm / 3, 0, thicknessMm / 3];
  return offsets
    .map((off) => {
      const p = add(a, n, off);
      const q = add(b, n, off);
      const w = off === 0 ? theme.thinLineMm : theme.symbolLineMm;
      return `<line x1="${fmt(p.x)}" y1="${fmt(p.y)}" x2="${fmt(q.x)}" y2="${fmt(q.y)}" stroke="${theme.lineColor}" stroke-width="${w}"/>`;
    })
    .join('');
}

/** Hueco de paso sin carpintería: línea discontinua entre jambas. */
export function openingSymbol(a: Pt, b: Pt, theme: PlanSvgTheme): string {
  return `<line x1="${fmt(a.x)}" y1="${fmt(a.y)}" x2="${fmt(b.x)}" y2="${fmt(b.y)}" stroke="${theme.lineColor}" stroke-width="${theme.thinLineMm}" stroke-dasharray="${theme.dimTickMm * 2} ${theme.dimTickMm * 1.5}"/>`;
}
