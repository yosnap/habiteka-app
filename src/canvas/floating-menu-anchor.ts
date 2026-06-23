/**
 * Anclaje del menú flotante de acciones sobre el objeto seleccionado.
 *
 * Lógica PURA (sin React/Konva) para poder testearla: dado el conjunto de objetos
 * seleccionados y la vista (zoom/pan) del stage, calcula dónde colocar el menú en
 * coordenadas de PANTALLA, anclado sobre el bounding box de la selección.
 *
 * El editor usa Konva con el `Group` del objeto posicionado en su esquina superior
 * izquierda (`x=o.x, y=o.y`) y `rotation` sobre esa esquina (sin offset). Por eso el
 * AABB se calcula rotando las 4 esquinas alrededor de (x, y), el mismo criterio que
 * mantiene 2D y 3D alineados.
 */
import type { StructObj } from './types';

/** Rectángulo eje-alineado en coordenadas de MUNDO (las del documento). */
export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Vista del stage: escala uniforme y desplazamiento (pan), igual que Konva. */
export interface StageView {
  scale: number;
  x: number;
  y: number;
}

/** Área visible del canvas en píxeles de pantalla (relativa al contenedor). */
export interface Viewport {
  width: number;
  height: number;
}

export type MenuPlacement = 'top' | 'bottom';

export interface AnchorResult {
  /** Centro X del menú, en píxeles de pantalla (relativo al contenedor del canvas). */
  x: number;
  /** Borde Y del menú (su parte superior), en píxeles de pantalla. */
  y: number;
  placement: MenuPlacement;
}

/** Esquinas de un objeto rotado, en coordenadas de mundo. */
function rotatedCorners(o: StructObj): Array<{ x: number; y: number }> {
  const rad = (o.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Konva rota sobre la esquina (o.x, o.y), no sobre el centro.
  const local = [
    { x: 0, y: 0 },
    { x: o.width, y: 0 },
    { x: o.width, y: o.height },
    { x: 0, y: o.height },
  ];
  return local.map((p) => ({
    x: o.x + p.x * cos - p.y * sin,
    y: o.y + p.x * sin + p.y * cos,
  }));
}

/**
 * AABB en coordenadas de mundo de los objetos seleccionados, respetando su rotación.
 * Devuelve `null` si no hay ids o ninguno existe.
 */
export function selectionAabb(objects: StructObj[], ids: string[]): WorldRect | null {
  const selected = objects.filter((o) => ids.includes(o.id));
  if (selected.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const o of selected) {
    for (const c of rotatedCorners(o)) {
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
    }
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Convierte un punto de mundo a píxeles de pantalla aplicando la vista. */
export function worldToScreen(
  point: { x: number; y: number },
  view: StageView,
): { x: number; y: number } {
  return {
    x: point.x * view.scale + view.x,
    y: point.y * view.scale + view.y,
  };
}

/** Gap entre el menú y el bbox, y margen de seguridad contra los bordes (px de pantalla). */
const GAP = 12;
const EDGE_MARGIN = 8;

/**
 * Posición de anclaje del menú sobre el AABB de la selección.
 *
 * Centra el menú horizontalmente sobre el bbox y lo coloca ENCIMA (con un gap). Si
 * no cabe arriba dentro del viewport, lo coloca DEBAJO. Hace clamp horizontal y
 * vertical para que el menú no se salga del área visible.
 *
 * `reservedTop` permite reservar una franja superior (p. ej. la toolbar/controles
 * de zoom flotantes) para que el menú no la solape.
 */
export function anchorPosition(
  aabb: WorldRect,
  view: StageView,
  viewport: Viewport,
  menuSize: { width: number; height: number },
  reservedTop = 0,
): AnchorResult {
  const topLeft = worldToScreen({ x: aabb.x, y: aabb.y }, view);
  const bottomRight = worldToScreen(
    { x: aabb.x + aabb.width, y: aabb.y + aabb.height },
    view,
  );
  const centerX = (topLeft.x + bottomRight.x) / 2;

  // ¿Cabe encima del bbox respetando la franja reservada?
  const yAbove = topLeft.y - GAP - menuSize.height;
  const fitsAbove = yAbove >= reservedTop + EDGE_MARGIN;
  const placement: MenuPlacement = fitsAbove ? 'top' : 'bottom';
  const yRaw = fitsAbove ? yAbove : bottomRight.y + GAP;

  // Clamp horizontal: el centro debe dejar el menú completo dentro del viewport.
  const half = menuSize.width / 2;
  const minX = EDGE_MARGIN + half;
  const maxX = viewport.width - EDGE_MARGIN - half;
  const clampedX = minX > maxX ? viewport.width / 2 : clamp(centerX, minX, maxX);

  // Clamp vertical: el menú no debe salirse por arriba (franja reservada) ni por abajo.
  const minY = reservedTop + EDGE_MARGIN;
  const maxY = viewport.height - EDGE_MARGIN - menuSize.height;
  const clampedY = minY > maxY ? minY : clamp(yRaw, minY, maxY);

  return { x: clampedX, y: clampedY, placement };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
