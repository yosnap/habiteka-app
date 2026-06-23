/**
 * Auto-amueblado procedural del asistente de diseño: coloca los muebles SELECCIONADOS por el
 * usuario en una sala rectangular, por reglas (sin IA). Lógica PURA: recibe el doc de la sala y
 * la selección, y devuelve los `StructObj` colocados + los que no cupieron (`omitted`).
 *
 * Sin solapes (red-team): los muebles de cada pared se reparten EN FILA según su ancho real, y
 * las esquinas se reservan restando el fondo de las paredes perpendiculares, para que una
 * encimera (pared N) y una nevera (pared O) no se monten en la esquina. Las piezas centrales
 * (mesa, isla, alfombra) se colocan en un recinto interior reducido por el fondo de las filas.
 * Si algo no cabe, NO se solapa: se acumula en `omitted` para que la UI avise.
 *
 * PRECONDICIÓN: solo salas RECTANGULARES axis-aligned (las que genera el wizard). Si el contorno
 * no es usable, devuelve { objects: [], omitted: [] }.
 */
import type { CanvasDoc, StructObj, StructKind } from '../types';
import { metersToPx, catalogSizePx } from '../scale';
import { CATALOG_BY_KIND } from '../catalog';
import type { RoomType } from './room-types';
import {
  ROOM_FURNITURE,
  defaultSelection,
  type WallAnchor,
  type FurnitureSelection,
  type RoomFurnitureOption,
} from './room-furniture-options';

/** Separación del mueble respecto a la pared de anclaje (m). */
const WALL_GAP_M = 0.05;
/** Separación entre muebles consecutivos de una misma fila (m). */
const ITEM_GAP_M = 0.1;

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

/** Tamaño en px de un kind según sus medidas reales del catálogo y la escala. */
function kindSizePx(kind: StructKind, pxPerMeter: number): { w: number; h: number } {
  const entry = CATALOG_BY_KIND[kind];
  if (!entry) return { w: 40, h: 40 };
  return catalogSizePx(entry, { pxPerMeter });
}

/** Un ítem a colocar: su kind, anchor y orden de fila, ya con su tamaño en px. */
interface Item {
  kind: StructKind;
  anchor: WallAnchor;
  order: number;
  w: number;
  h: number;
}

/** Expande la selección a ítems concretos (cantidad N → N ítems), con su opción de sala. */
function buildItems(
  selection: FurnitureSelection,
  options: readonly RoomFurnitureOption[],
  pxPerMeter: number,
): Item[] {
  const items: Item[] = [];
  for (const o of options) {
    const qty = selection[o.kind] ?? 0;
    if (qty <= 0) continue;
    const { w, h } = kindSizePx(o.kind, pxPerMeter);
    for (let i = 0; i < qty; i++) {
      items.push({ kind: o.kind, anchor: o.anchor, order: o.order, w, h });
    }
  }
  return items;
}

/**
 * Fondo (profundidad hacia el interior, px) que ocupa una pared dada por sus ítems: para N/S es
 * la altura del mueble; para E/O es el ancho. Sirve para reservar las esquinas.
 */
function rowDepthPx(items: readonly Item[], anchor: WallAnchor): number {
  let max = 0;
  for (const it of items) {
    if (it.anchor !== anchor) continue;
    const depth = anchor === 'N' || anchor === 'S' ? it.h : it.w;
    max = Math.max(max, depth);
  }
  return max;
}

/**
 * Reparte los muebles seleccionados de una sala según su tipo, SIN solapes. Devuelve los objetos
 * colocados y los kinds que no cupieron. Sin `selection`, usa la selección por defecto del tipo.
 */
export function autofurnish(
  doc: CanvasDoc,
  roomType: RoomType,
  selection?: FurnitureSelection,
): { objects: StructObj[]; omitted: StructKind[] } {
  const pxPerMeter = doc.scale?.pxPerMeter ?? 100;
  const sel = selection ?? defaultSelection(roomType);
  const options = ROOM_FURNITURE[roomType] ?? [];
  const items = buildItems(sel, options, pxPerMeter);

  // Salas NO rectangulares (L/U/T): el doc trae el polígono del suelo. El reparto por filas
  // asume un rectángulo (bbox de muros), así que sobre una forma con recorte colocaría muebles
  // FUERA del contorno. Decisión de alcance: no auto-amueblar; se devuelven todos los kinds
  // seleccionados como omitidos para que la UI avise ("se amuebla a mano"). El sub-rectángulo
  // inscrito amueblado queda como mejora futura.
  if (doc.floorOutline && doc.floorOutline.length >= 3) {
    return { objects: [], omitted: items.map((it) => it.kind) };
  }

  const inner = interiorRect(doc);
  if (!inner) return { objects: [], omitted: [] };

  const gap = metersToPx(WALL_GAP_M, { pxPerMeter });
  const itemGap = metersToPx(ITEM_GAP_M, { pxPerMeter });

  // Fondo de cada pared para reservar esquinas: las filas N/S no invaden el fondo de E/O y viceversa.
  const depthN = rowDepthPx(items, 'N');
  const depthS = rowDepthPx(items, 'S');
  const depthE = rowDepthPx(items, 'E');
  const depthO = rowDepthPx(items, 'O');

  const objects: StructObj[] = [];
  const omitted: StructKind[] = [];
  let seq = 0;
  const nextId = () => `auto-${roomType}-${seq++}`;

  // Coloca una FILA de ítems a lo largo de una pared, centrada en su longitud útil. Reserva las
  // esquinas restando el fondo de las paredes perpendiculares. Lo que no cabe → omitted.
  const placeRow = (anchor: 'N' | 'S' | 'E' | 'O') => {
    const row = items
      .filter((it) => it.anchor === anchor)
      .sort((a, b) => b.order - a.order); // mayor order primero → menor order queda al centro
    if (row.length === 0) return;

    const horizontal = anchor === 'N' || anchor === 'S';
    // Rotación (Konva, rotation=0 → el frente mira al sur) para que el mueble MIRE AL INTERIOR.
    // En N/S basta 0/180: la rotación de 180° sobre la esquina mantiene el MISMO AABB (footprint
    // intacto), así que no hay que compensar la posición. El armario en la pared sur ya no sale
    // de espaldas. En paredes laterales (E/O) se deja 0: girarlos 90° desplazaría el objeto sobre
    // su esquina (pivote de Konva) y habría que recolocarlo; los muebles de E/O son pequeños o
    // cuadrados (lámpara, planta, inodoro, ducha) y apenas tienen "frente", así que no compensa.
    const rotation = anchor === 'S' ? 180 : 0;
    // Longitud útil a lo largo de la pared, descontando las esquinas (fondo de las perpendiculares).
    const usable = horizontal
      ? inner.width - depthO - depthE - 2 * gap
      : inner.height - depthN - depthS - 2 * gap;
    const along = (it: Item) => (horizontal ? it.w : it.h);
    const totalLen = row.reduce((s, it) => s + along(it), 0) + itemGap * (row.length - 1);

    // Inicio de la fila centrada en el tramo útil (que arranca tras la esquina perpendicular).
    const start0 = horizontal ? inner.x + depthO + gap : inner.y + depthN + gap;
    let cursor = start0 + Math.max(0, (usable - totalLen) / 2);

    for (const it of row) {
      const len = along(it);
      // Si no cabe en lo que queda de pared útil, se omite (no se solapa).
      if (len > usable + 1e-6 || cursor + len > start0 + usable + 1e-6) {
        omitted.push(it.kind);
        continue;
      }
      let x: number;
      let y: number;
      if (horizontal) {
        x = cursor;
        y = anchor === 'N' ? inner.y + gap : inner.y + inner.height - it.h - gap;
      } else {
        y = cursor;
        x = anchor === 'O' ? inner.x + gap : inner.x + inner.width - it.w - gap;
      }
      objects.push({ id: nextId(), kind: it.kind, x, y, width: it.w, height: it.h, rotation });
      cursor += len + itemGap;
    }
  };

  placeRow('N');
  placeRow('S');
  placeRow('E');
  placeRow('O');

  // Piezas centrales en el recinto interior REDUCIDO por el fondo de las 4 filas (no chocan con ellas).
  const centerItems = items.filter((it) => it.anchor === 'center').sort((a, b) => a.order - b.order);
  if (centerItems.length > 0) {
    const cx0 = inner.x + depthO + gap;
    const cy0 = inner.y + depthN + gap;
    const cw = inner.width - depthO - depthE - 2 * gap;
    const ch = inner.height - depthN - depthS - 2 * gap;
    // Apila las piezas centrales verticalmente en el centro del recinto reducido.
    const totalH = centerItems.reduce((s, it) => s + it.h, 0) + itemGap * (centerItems.length - 1);
    let cy = cy0 + Math.max(0, (ch - totalH) / 2);
    for (const it of centerItems) {
      if (it.w > cw + 1e-6 || it.h > ch + 1e-6 || cy + it.h > cy0 + ch + 1e-6) {
        omitted.push(it.kind);
        continue;
      }
      const x = cx0 + (cw - it.w) / 2;
      objects.push({ id: nextId(), kind: it.kind, x, y: cy, width: it.w, height: it.h, rotation: 0 });
      cy += it.h + itemGap;
    }
  }

  return { objects, omitted };
}
