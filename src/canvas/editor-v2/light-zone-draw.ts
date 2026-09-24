/**
 * Máquina de dibujo de zonas de luces SOBRE EL PLANO grande, con los mismos
 * tres modos que el selector de zonas del render (estancia, punto a punto y
 * rectángulo) pero con una diferencia importante: una zona de luces puede tener
 * VARIAS partes sueltas, así que en modo estancia se van sumando y quitando
 * estancias hasta confirmar.
 *
 * Todo lo de aquí es puro: el lienzo solo le pasa puntos ya imantados y lee el
 * resultado. Comparte con el selector del render el cierre de contornos y el
 * rectángulo mínimo, para no tener dos criterios de trazo válido.
 */
import {
  closeDraftPolygon,
  closesOnFirstVertex,
  rectanglePolygon,
  type RegionMode,
} from '@/lib/editor-document/render-region-draw';
import { MAX_ZONE_PARTS } from '@/lib/editor-document/light-zone-validation';
import type { Point } from '@/lib/editor-document/schema';

export type LightZoneMode = RegionMode;

/** Parte de la zona; `roomId` solo lo trae el modo estancia, para poder quitarla. */
export interface LightZonePart {
  roomId: string | null;
  polygon: Point[];
}

export interface LightZoneDraft {
  mode: LightZoneMode;
  parts: LightZonePart[];
  /** Vértices del contorno en curso (solo modo punto a punto). */
  vertices: Point[];
}

/** Resultado de un gesto: el borrador nuevo, si ya se puede cerrar y el motivo si falló. */
export interface LightZoneStep {
  draft: LightZoneDraft;
  /** El trazo terminó y la zona se puede guardar ya. */
  done: boolean;
  error: string | null;
}

/** Radio de cierre sobre el primer vértice y lado mínimo del rectángulo, en mm del plano. */
export const ZONE_CLOSE_RADIUS_MM = 400;
export const MIN_ZONE_RECTANGLE_SIDE_MM = 300;

export const LIGHT_ZONE_MODE_HINTS: Record<LightZoneMode, string> = {
  room: 'Clic en cada estancia, escalera o rampa para sumarla o quitarla · Intro crea la zona · Esc cancela',
  polygon: 'Clic para marcar vértices · cierra en el primero, con doble clic o con Intro · Esc cancela',
  rectangle: 'Arrastra sobre el plano para marcar el rectángulo · Esc cancela',
};

export function emptyLightZoneDraft(mode: LightZoneMode): LightZoneDraft {
  return { mode, parts: [], vertices: [] };
}

const step = (draft: LightZoneDraft, done = false, error: string | null = null): LightZoneStep => ({ draft, done, error });

const full = (draft: LightZoneDraft) =>
  draft.parts.length >= MAX_ZONE_PARTS
    ? `Una zona admite como mucho ${MAX_ZONE_PARTS} partes: quita alguna antes de añadir otra.`
    : null;

/** Modo estancia: la misma estancia se suma con un clic y se quita con otro. */
export function toggleRoomPart(draft: LightZoneDraft, room: { roomId: string; polygon: Point[] }): LightZoneStep {
  if (draft.parts.some((part) => part.roomId === room.roomId))
    return step({ ...draft, parts: draft.parts.filter((part) => part.roomId !== room.roomId) });
  const limit = full(draft);
  if (limit) return step(draft, false, limit);
  return step({ ...draft, parts: [...draft.parts, { roomId: room.roomId, polygon: room.polygon }] });
}

/** Punto a punto: añade un vértice, o cierra el contorno si se pulsa sobre el primero. */
export function addZoneVertex(draft: LightZoneDraft, point: Point): LightZoneStep {
  if (closesOnFirstVertex(draft.vertices, point, ZONE_CLOSE_RADIUS_MM)) return closeZonePart(draft);
  return step({ ...draft, vertices: [...draft.vertices, point] });
}

/** Retira el último vértice marcado; sin vértices no cambia nada. */
export function undoZoneVertex(draft: LightZoneDraft): LightZoneDraft {
  return { ...draft, vertices: draft.vertices.slice(0, -1) };
}

/** Cierra el contorno en curso. Un contorno cerrado termina el trazo punto a punto. */
export function closeZonePart(draft: LightZoneDraft): LightZoneStep {
  const limit = full(draft);
  if (limit) return step(draft, false, limit);
  const closure = closeDraftPolygon(draft.vertices);
  if (!closure.ok)
    return step(draft, false, closure.reason === 'pocos-vertices'
      ? 'Marca al menos tres vértices antes de cerrar la zona.'
      : 'El contorno se cruza consigo mismo: vuelve a marcarlo sin lazos.');
  return step({ ...draft, vertices: [], parts: [...draft.parts, { roomId: null, polygon: closure.polygon }] }, true);
}

/** Rectángulo: un arrastre suficiente cierra la zona de una vez. */
export function addZoneRectangle(draft: LightZoneDraft, start: Point, end: Point): LightZoneStep {
  const limit = full(draft);
  if (limit) return step(draft, false, limit);
  const polygon = rectanglePolygon(start, end, MIN_ZONE_RECTANGLE_SIDE_MM);
  if (!polygon) return step(draft, false, 'Arrastra un rectángulo de al menos 30 cm de lado.');
  return step({ ...draft, parts: [...draft.parts, { roomId: null, polygon }] }, true);
}

/** Contornos listos para `addLightZone` / `setLightZonePolygons`. */
export function draftPolygons(draft: LightZoneDraft): Point[][] {
  return draft.parts.map((part) => part.polygon);
}

/** Motivo por el que aún no se puede guardar la zona, o null si ya vale. */
export function draftBlocker(draft: LightZoneDraft): string | null {
  return draft.parts.length ? null : 'Marca al menos una parte de la zona antes de crearla.';
}
