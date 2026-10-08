import type { Point } from '@/lib/editor-document/schema';

/**
 * Medida tecleada mientras se dibuja o se arrastra un muro (como en SketchUp): cifras y una coma o un punto decimal en
 * metros; Retroceso borra, Enter fija y Esc vacía. `consumed` indica que la tecla es de la medida y no un atajo.
 */
export function typedLengthKey(buffer: string, key: string): { buffer: string; consumed: boolean; commitMm?: number } {
  if (/^[0-9]$/.test(key)) return buffer.length < 7 ? { buffer: buffer + key, consumed: true } : { buffer, consumed: true };
  if (key === ',' || key === '.') return buffer.includes(',') ? { buffer, consumed: true } : { buffer: (buffer || '0') + ',', consumed: true };
  if (!buffer) return { buffer, consumed: false };
  if (key === 'Backspace') return { buffer: buffer.slice(0, -1), consumed: true };
  if (key === 'Escape') return { buffer: '', consumed: true };
  if (key === 'Enter') {
    const meters = Number(buffer.replace(',', '.'));
    return Number.isFinite(meters) && meters > 0 ? { buffer: '', consumed: true, commitMm: Math.round(meters * 1000) } : { buffer: '', consumed: true };
  }
  return { buffer, consumed: false };
}

/** Punto a `lengthMm` de `from` en la dirección de `toward`; sin dirección, hacia la derecha. */
export function pointAtLength(from: Point, toward: Point, lengthMm: number): Point {
  const dx = toward.x - from.x, dy = toward.y - from.y, length = Math.hypot(dx, dy);
  if (length < 1e-6) return { x: from.x + lengthMm, y: from.y };
  return { x: from.x + dx / length * lengthMm, y: from.y + dy / length * lengthMm };
}
