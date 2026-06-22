/**
 * Auto-amueblado procedural (F7.5): coloca un set de muebles coherente según el tipo de sala,
 * por reglas (sin IA). Lógica PURA: recibe el doc de una sala rectangular y devuelve los
 * `StructObj` de los muebles colocados en coordenadas absolutas (px), listos para insertar.
 *
 * PRECONDICIÓN (red-team #6): solo salas RECTANGULARES axis-aligned (las que genera el wizard).
 * El recinto interior se deriva del bounding box de los muros restando su grosor. Si el doc no
 * tiene un contorno rectangular usable, devuelve [] (no coloca muebles fuera de las paredes).
 */
import type { CanvasDoc, StructObj, StructKind } from '../types';
import { CATALOG_BY_KIND } from '../catalog';
import { metersToPx, catalogSizePx } from '../scale';
import { FURNISH_TEMPLATES, type FurniturePlacement } from './furnish-templates';
import type { RoomType } from './room-types';

/** Separación del mueble respecto a la pared de anclaje (m). */
const WALL_GAP_M = 0.05;

/** Rectángulo interior de la sala en px (espacio útil entre muros). */
interface InteriorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Deriva el rectángulo INTERIOR de una sala rectangular a partir de sus muros: bounding box
 * de los muros menos el grosor de muro por cada lado. Devuelve null si no hay muros o el
 * interior resultante no es positivo.
 */
export function interiorRect(doc: CanvasDoc): InteriorRect | null {
  const walls = doc.objects.filter((o) => o.kind === 'wall');
  if (walls.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxThickness = 0;
  for (const w of walls) {
    // Solo contornos axis-aligned: ignoramos muros rotados (sala no rectangular).
    if (Math.abs(w.rotation % 90) > 1e-3) return null;
    minX = Math.min(minX, w.x);
    minY = Math.min(minY, w.y);
    maxX = Math.max(maxX, w.x + w.width);
    maxY = Math.max(maxY, w.y + w.height);
    maxThickness = Math.max(maxThickness, Math.min(w.width, w.height));
  }
  const t = maxThickness;
  const x = minX + t;
  const y = minY + t;
  const width = maxX - minX - 2 * t;
  const height = maxY - minY - 2 * t;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

/** Tamaño en px de un kind según sus medidas reales del catálogo y la escala. Reusa
 *  `catalogSizePx` (misma fuente de verdad que el editor: redondeo + mínimo de 2 px). */
function kindSizePx(kind: StructKind, pxPerMeter: number): { w: number; h: number } {
  const entry = CATALOG_BY_KIND[kind];
  if (!entry) return { w: 40, h: 40 };
  return catalogSizePx(entry, { pxPerMeter });
}

/**
 * Coloca un mueble (placement) dentro del interior: calcula la esquina (x,y) en px según su
 * pared de anclaje, la fracción a lo largo de ella y su tamaño. El mueble queda pegado a la
 * pared con una pequeña separación.
 */
function placeOne(
  id: string,
  p: FurniturePlacement,
  inner: InteriorRect,
  pxPerMeter: number,
): StructObj {
  const { w, h } = kindSizePx(p.kind, pxPerMeter);
  const gap = metersToPx(WALL_GAP_M, { pxPerMeter });
  let x: number;
  let y: number;
  switch (p.anchor) {
    case 'N':
      x = inner.x + p.along * inner.width - w / 2;
      y = inner.y + gap;
      break;
    case 'S':
      x = inner.x + p.along * inner.width - w / 2;
      y = inner.y + inner.height - h - gap;
      break;
    case 'O':
      x = inner.x + gap;
      y = inner.y + p.along * inner.height - h / 2;
      break;
    case 'E':
      x = inner.x + inner.width - w - gap;
      y = inner.y + p.along * inner.height - h / 2;
      break;
    default: // center
      x = inner.x + p.along * inner.width - w / 2;
      y = inner.y + inner.height / 2 - h / 2;
  }
  // Acotar dentro del interior para no salirse.
  x = Math.max(inner.x, Math.min(x, inner.x + inner.width - w));
  y = Math.max(inner.y, Math.min(y, inner.y + inner.height - h));
  return { id, kind: p.kind, x, y, width: w, height: h, rotation: p.rotation };
}

/**
 * Devuelve los muebles a colocar en una sala rectangular según su tipo. Vacío si la sala no
 * es rectangular usable (no amuebla salas dibujadas a mano arbitrarias en v1).
 */
export function autofurnish(doc: CanvasDoc, roomType: RoomType): StructObj[] {
  const inner = interiorRect(doc);
  if (!inner) return [];
  const pxPerMeter = doc.scale?.pxPerMeter ?? 100;
  const template = FURNISH_TEMPLATES[roomType] ?? [];
  return template.map((p, i) => placeOne(`auto-${roomType}-${i}`, p, inner, pxPerMeter));
}
