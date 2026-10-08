import type { LeafDesign } from '@/lib/editor-document/opening-look-options';
import type { LeafPart } from './opening-leaf-parts';

/** Alturas de la hoja: de su canto inferior al superior, sobre la cota de la abertura. */
export interface LeafSpan { bottom: number; top: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Pieza rectangular entre `x1`–`x2` a lo largo de la hoja y `y1`–`y2` en altura. */
export function block(x1: number, x2: number, y1: number, y2: number, thickness: number, extra: Partial<LeafPart> = {}): LeafPart {
  return { role: 'leaf', along: (x1 + x2) / 2, y: (y1 + y2) / 2, length: x2 - x1, height: y2 - y1, thickness, ...extra };
}

/**
 * Hoja con ranuras horizontales: bandas al grueso completo sobre un alma más delgada y en sombra, que asoma en cada
 * ranura. La seccional de garaje usa las mismas ranuras, más separadas, entre sus paneles.
 */
export function groovedLeaf(length: number, { bottom, top }: LeafSpan, thickness: number, spacingMm: number, grooveMm = 12): LeafPart[] {
  const height = top - bottom, count = Math.max(2, Math.round(height / spacingMm));
  const band = (height - (count - 1) * grooveMm) / count, half = length / 2;
  return [block(-half, half, bottom, top, Math.max(4, thickness - 10), { tone: 'shade' }),
    ...Array.from({ length: count }, (_, index) => {
      const y = bottom + index * (band + grooveMm);
      return block(-half, half, y, y + band, thickness);
    })];
}

/** Chapa nervada en vertical (basculante): bandas a lo largo de la hoja sobre un alma en sombra. */
export function ribbedLeaf(length: number, { bottom, top }: LeafSpan, thickness: number, spacingMm: number, grooveMm = 14): LeafPart[] {
  const count = Math.max(2, Math.round(length / spacingMm)), band = (length - (count - 1) * grooveMm) / count, half = length / 2;
  return [block(-half, half, bottom, top, Math.max(4, thickness - 10), { tone: 'shade' }),
    ...Array.from({ length: count }, (_, index) => {
      const x = -half + index * (band + grooveMm);
      return block(x, x + band, bottom, top, thickness);
    })];
}

/** Cuarterón: bisel en sombra rehundido y plafón central algo más alto, dentro del bastidor. */
function raisedPanel(x1: number, x2: number, y1: number, y2: number, thickness: number): LeafPart[] {
  const bevel = Math.min(26, (x2 - x1) / 5, (y2 - y1) / 5), ring = Math.max(4, thickness - 12), field = Math.max(5, thickness - 5);
  const shade = { tone: 'shade' as const };
  return [block(x1, x2, y1, y1 + bevel, ring, shade), block(x1, x2, y2 - bevel, y2, ring, shade),
    block(x1, x1 + bevel, y1 + bevel, y2 - bevel, ring, shade), block(x2 - bevel, x2, y1 + bevel, y2 - bevel, ring, shade),
    block(x1 + bevel, x2 - bevel, y1 + bevel, y2 - bevel, field)];
}

/**
 * Bastidor de largueros y travesaños al grueso completo con huecos para `cells` (filas de abajo arriba y columnas):
 * cada hueco se rellena con `fill`. Los travesaños intermedios y el montante central separan las celdas.
 */
function framedLeaf(length: number, span: LeafSpan, thickness: number, rows: readonly number[], columns: number,
  fill: (x1: number, x2: number, y1: number, y2: number) => LeafPart[], rails = { stile: .13, bottom: 1.8 }): LeafPart[] {
  const half = length / 2, stile = clamp(length * rails.stile, 40, 120), bottomRail = Math.min(stile * rails.bottom, (span.top - span.bottom) / 5);
  const mid = stile * .8, inner = { x1: -half + stile, x2: half - stile, y1: span.bottom + bottomRail, y2: span.top - stile };
  const parts = [block(-half, -half + stile, span.bottom, span.top, thickness), block(half - stile, half, span.bottom, span.top, thickness),
    block(inner.x1, inner.x2, span.bottom, inner.y1, thickness), block(inner.x1, inner.x2, inner.y2, span.top, thickness)];
  const usableY = inner.y2 - inner.y1 - (rows.length - 1) * mid, total = rows.reduce((sum, value) => sum + value, 0);
  const cellWidth = (inner.x2 - inner.x1 - (columns - 1) * mid) / columns;
  let y = inner.y1;
  rows.forEach((weight, row) => {
    const height = usableY * weight / total;
    for (let column = 0; column < columns; column++) {
      const x = inner.x1 + column * (cellWidth + mid);
      parts.push(...fill(x, x + cellWidth, y, y + height));
      if (column < columns - 1) parts.push(block(x + cellWidth, x + cellWidth + mid, y, y + height, thickness));
    }
    if (row < rows.length - 1) parts.push(block(inner.x1, inner.x2, y + height, y + height + mid, thickness));
    y += height + mid;
  });
  return parts;
}

const glassPane = (x1: number, x2: number, y1: number, y2: number): LeafPart[] =>
  [block(x1, x2, y1, y2, 8, { role: 'glass', tone: 'glass' })];

/** Vidrio con junquillos: cuadrícula de barrotillos al grueso de la hoja delante y detrás del vidrio. */
function griddedGlass(thickness: number) {
  return (x1: number, x2: number, y1: number, y2: number): LeafPart[] => {
    const bar = 26, columns = x2 - x1 >= 420 ? 2 : 1, rows = Math.max(2, Math.round((y2 - y1) / 340));
    const width = (x2 - x1 - (columns - 1) * bar) / columns, height = (y2 - y1 - (rows - 1) * bar) / rows;
    return [...glassPane(x1, x2, y1, y2),
      ...Array.from({ length: columns - 1 }, (_, index) => block(x1 + (index + 1) * width + index * bar, x1 + (index + 1) * (width + bar), y1, y2, thickness - 6)),
      ...Array.from({ length: rows - 1 }, (_, index) => block(x1, x2, y1 + (index + 1) * height + index * bar, y1 + (index + 1) * (height + bar), thickness - 6))];
  };
}

/** Lamas inclinadas: cada lama, un escalón con su parte alta retrasada y en sombra; entre lamas se ve a través. */
function louvers(thickness: number) {
  return (x1: number, x2: number, y1: number, y2: number): LeafPart[] => {
    const pitch = 52, count = Math.max(2, Math.floor((y2 - y1) / pitch)), start = y1 + ((y2 - y1) - count * pitch) / 2, depth = thickness * .45;
    return Array.from({ length: count }, (_, index) => {
      const y = start + index * pitch;
      return [block(x1, x2, y + 6, y + 28, depth, { across: thickness * .2 }),
        block(x1, x2, y + 22, y + 44, depth, { across: -thickness * .2, tone: 'shade' })];
    }).flat();
  };
}

/**
 * Geometría procedural de cada diseño de hoja de puerta. «Lisa» es la hoja maciza de siempre, una sola pieza; la
 * vidriera conserva el bastidor y el zócalo del modelo histórico. Lo demás se construye con piezas al grueso de la hoja.
 */
export function designParts(design: LeafDesign, length: number, span: LeafSpan, thickness: number): LeafPart[] {
  const height = span.top - span.bottom, half = length / 2;
  switch (design) {
    case 'ranurada': return groovedLeaf(length, span, thickness, 300);
    case 'molduras-2': return framedLeaf(length, span, thickness, [.38, .62], 1, (x1, x2, y1, y2) => raisedPanel(x1, x2, y1, y2, thickness));
    case 'molduras-4': return framedLeaf(length, span, thickness, length >= 600 ? [.42, .58] : [1, 1, 1, 1.3], length >= 600 ? 2 : 1,
      (x1, x2, y1, y2) => raisedPanel(x1, x2, y1, y2, thickness));
    case 'vidrio-cuadriculado': return framedLeaf(length, span, thickness, [1], 1, griddedGlass(thickness), { stile: .11, bottom: 2.2 });
    case 'lamas': return framedLeaf(length, span, thickness, [1], 1, louvers(thickness), { stile: .11, bottom: 1.6 });
    case 'franja-vidrio': {
      // Franja vertical de vidrio centrada, con hoja maciza alrededor.
      const width = clamp(length * .14, 50, 150), margin = clamp(height * .14, 120, 340);
      const [x1, x2, y1, y2] = [-width / 2, width / 2, span.bottom + margin, span.top - margin];
      return [block(-half, x1, span.bottom, span.top, thickness), block(x2, half, span.bottom, span.top, thickness),
        block(x1, x2, span.bottom, y1, thickness), block(x1, x2, y2, span.top, thickness), ...glassPane(x1, x2, y1, y2)];
    }
    default: return [{ role: 'leaf', along: 0, y: (span.top + span.bottom) / 2, length, height, thickness }];
  }
}
