import { eligibleCeilingRooms, insideRoom } from './ceiling-geometry';
import { buildingDocuments } from './building-levels';
import type { Estilo } from '@/lib/contracts';
import { deriveRooms, type DerivedRoom } from './rooms';
import type { EditorDocument, Point, Wall } from './schema';

export interface DesignScope {
  kind: 'all' | 'interior' | 'exterior' | 'rooms';
  roomIds: string[];
  structureIds?: string[];
}

export const wholeDesignScope = (): DesignScope => ({ kind: 'all', roomIds: [] });

/** El estilo de una planta ya diseñada también orienta las demás plantas. */
export function buildingDesignStyle(doc: EditorDocument): Estilo | undefined {
  return doc.designStyle ?? buildingDocuments(doc).map((level) => level.document.designStyle).find((style) => style !== undefined);
}

/** Las propuestas parciales mantienen el estilo aplicado en el inmueble. */
export function assertCompatibleDesignStyle(doc: EditorDocument, style: Estilo, scope: DesignScope): void {
  if (scope.kind !== 'all' && buildingDocuments(doc).some((level) => level.document.designStyle && level.document.designStyle !== style))
    throw new Error('El inmueble ya tiene otro estilo. Usa el estilo existente o rediseña toda la planta.');
}

/** Las zonas de diseño son estancias completas del documento, no píxeles de un render. */
export function designScopeRooms(doc: EditorDocument, scope: DesignScope): DerivedRoom[] {
  if (!['all', 'interior', 'exterior', 'rooms'].includes(scope.kind)) throw new Error('Ámbito de diseño no válido');
  const rooms = deriveRooms(doc);
  if (scope.kind === 'all') return rooms;
  const indoorIds = new Set(eligibleCeilingRooms(doc).map((room) => room.id));
  const selected = scope.kind === 'rooms'
    ? rooms.filter((room) => scope.roomIds.includes(room.id))
    : rooms.filter((room) => scope.kind === 'interior' ? indoorIds.has(room.id) : !indoorIds.has(room.id));
  if (!selected.length || (scope.kind === 'rooms' && selected.length !== new Set(scope.roomIds).size))
    throw new Error('El ámbito del diseño ya no coincide con las estancias del plano. Vuelve a elegirlas.');
  return selected;
}

/** Verifica las piezas externas a las estancias antes de pedir o aplicar una propuesta. */
export function designScopeStructureIds(doc: EditorDocument, scope: DesignScope): ReadonlySet<string> {
  const ids = scope.structureIds ?? [];
  if (scope.kind !== 'rooms' && ids.length) throw new Error('Las piezas concretas requieren elegir estancias concretas.');
  const available = new Set([...(doc.stairs ?? []), ...(doc.ramps ?? [])].map((item) => item.id));
  if (new Set(ids).size !== ids.length || ids.some((id) => !available.has(id)))
    throw new Error('Una escalera, rampa o descansillo ya no coincide con el plano. Vuelve a elegirlo.');
  return new Set(ids);
}

/** Conserva la cara opuesta al aplicar una propuesta a una sola estancia. */
export function scopedWallSides(wall: Wall, rooms: readonly DerivedRoom[]): ('left' | 'right')[] {
  const sides = new Set<'left' | 'right'>();
  for (const room of rooms) {
    const edge = room.wallIds.indexOf(wall.id);
    if (edge >= 0) sides.add(room.vertexIds[edge] === wall.startVertexId ? 'left' : 'right');
  }
  return [...sides];
}

export function scopeContainsPoint(rooms: readonly DerivedRoom[], point: Point): boolean {
  return rooms.some((room) => insideRoom(point, room.boundary));
}
