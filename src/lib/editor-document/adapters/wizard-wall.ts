import type { Point } from '../schema';
import { numeric, record, unknownFields } from './shared';

/** Las cajas del wizard cubren esquinas; el editor métrico conecta sus ejes. */
export function wizardWall(obj: Record<string, unknown>, factor: number, issues: string[]): {
  from: Point; to: Point; thicknessMm: number;
} | null {
  if (obj.meta === undefined) return null;
  const meta = record(obj.meta);
  const horizontal = meta.nx === 0 && (meta.ny === 1 || meta.ny === -1);
  const vertical = meta.ny === 0 && (meta.nx === 1 || meta.nx === -1);
  if ((!horizontal && !vertical) || numeric(obj.rotation) !== 0 || obj.drawn === true)
    throw new Error('Metadatos de muro no convertibles: se requiere un muro ortogonal del asistente');
  unknownFields(meta, horizontal ? ['nx', 'ny', 'extLeft', 'extRight', 'loExt', 'hiExt']
    : ['nx', 'ny', 'topConvex', 'bottomConvex'], issues);
  const x = numeric(obj.x) * factor, y = numeric(obj.y) * factor;
  const width = numeric(obj.width) * factor, height = numeric(obj.height) * factor;
  if (width <= 0 || height <= 0) throw new Error('Dimensiones de muro no válidas');
  if (horizontal) {
    for (const [extension, convex] of [['loExt', 'extLeft'], ['hiExt', 'extRight']] as const) {
      if (typeof meta[convex] !== 'boolean' || numeric(meta[extension]) * factor !== (meta[convex] ? height : 0))
        throw new Error('Extensión de esquina no convertible');
    }
    if (width <= height) throw new Error('Longitud de muro no válida');
    return { from: { x: x + height / 2, y: y + height / 2 },
      to: { x: x + width - height / 2, y: y + height / 2 }, thicknessMm: height };
  }
  if (typeof meta.topConvex !== 'boolean' || typeof meta.bottomConvex !== 'boolean')
    throw new Error('Esquina de muro no convertible');
  return { from: { x: x + width / 2, y: y + (meta.topConvex ? -width / 2 : width / 2) },
    to: { x: x + width / 2, y: y + height + (meta.bottomConvex ? width / 2 : -width / 2) }, thicknessMm: width };
}
