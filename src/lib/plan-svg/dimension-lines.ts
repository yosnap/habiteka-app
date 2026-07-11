/**
 * Líneas de cota estilo CAD: línea paralela al elemento separada `dimOffsetMm`,
 * líneas de extensión desde los puntos reales, ticks oblicuos a 45° en los
 * extremos y etiqueta centrada sobre la línea (siempre legible: nunca boca
 * abajo). Coordenadas en mm del plano.
 */
import type { PlanDimension } from '@/lib/contracts';
import type { PlanSvgTheme } from './plan-svg-theme';
import { add, direction, escapeXml, fmt, normal, type Pt } from './svg-geometry';

/**
 * Dibuja una cota desplazada hacia `outwardSign` (+1 / −1 sobre la normal del
 * segmento). El llamador decide el lado (normalmente, alejándose del plano).
 */
export function dimensionLine(dim: PlanDimension, outwardSign: 1 | -1, theme: PlanSvgTheme): string {
  const dir = direction(dim.from, dim.to);
  if (!dir) return '';
  const n = normal(dir);
  const off = theme.dimOffsetMm * outwardSign;

  const a = add(dim.from, n, off);
  const b = add(dim.to, n, off);
  const parts: string[] = [];

  const thin = `stroke="${theme.lineColor}" stroke-width="${theme.thinLineMm}"`;

  // Líneas de extensión: del punto real hasta un poco más allá de la cota.
  const ext = off + theme.dimTickMm * 2 * outwardSign;
  parts.push(line(dim.from, add(dim.from, n, ext), thin));
  parts.push(line(dim.to, add(dim.to, n, ext), thin));

  // Línea de cota.
  parts.push(line(a, b, thin));

  // Ticks oblicuos a 45° (dir + normal), centrados en cada extremo.
  const tick = { x: (dir.x + n.x) * theme.dimTickMm, y: (dir.y + n.y) * theme.dimTickMm };
  for (const p of [a, b]) {
    parts.push(
      line({ x: p.x - tick.x, y: p.y - tick.y }, { x: p.x + tick.x, y: p.y + tick.y }, thin),
    );
  }

  // Etiqueta: centrada y ligeramente por encima de la línea de cota (lado del
  // desplazamiento), rotada con el segmento pero nunca boca abajo.
  const mid = add({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, n, theme.dimFontMm * 0.35 * outwardSign);
  let angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
  if (angle > 90 || angle <= -90) angle += 180;
  parts.push(
    `<text x="${fmt(mid.x)}" y="${fmt(mid.y)}" transform="rotate(${fmt(angle)} ${fmt(mid.x)} ${fmt(mid.y)})" text-anchor="middle" dominant-baseline="${outwardSign === 1 ? 'hanging' : 'auto'}" font-family="${theme.fontFamily}" font-size="${theme.dimFontMm}" fill="${theme.textColor}">${escapeXml(dim.label)}</text>`,
  );

  return parts.join('');
}

function line(p: Pt, q: Pt, strokeAttrs: string): string {
  return `<line x1="${fmt(p.x)}" y1="${fmt(p.y)}" x2="${fmt(q.x)}" y2="${fmt(q.y)}" ${strokeAttrs}/>`;
}
