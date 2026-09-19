import type { EditorDocument } from '@/lib/editor-document/schema';
import type { DerivedRoom } from '@/lib/editor-document/rooms';
import { planObjects, isBoundary } from '@/lib/editor-document/boundary-types';

export type SelectableKind = 'walls' | 'doors' | 'windows' | 'passages' | 'rooms' | 'patios' | 'furniture' | 'boundaries' | 'columns' | 'stairs' | 'ramps' | 'luminaires' | 'labels';

export const SELECTABLE_KINDS: { id: SelectableKind; label: string }[] = [
  { id: 'walls', label: 'Todas las paredes' }, { id: 'doors', label: 'Todas las puertas' }, { id: 'windows', label: 'Todas las ventanas' },
  { id: 'passages', label: 'Todos los huecos' }, { id: 'rooms', label: 'Todas las estancias' }, { id: 'patios', label: 'Todos los patios' },
  { id: 'furniture', label: 'Todos los muebles' }, { id: 'boundaries', label: 'Todos los cerramientos' }, { id: 'columns', label: 'Todas las columnas' },
  { id: 'stairs', label: 'Todas las escaleras' }, { id: 'ramps', label: 'Todas las rampas' }, { id: 'luminaires', label: 'Todas las luces' },
  { id: 'labels', label: 'Todos los textos' },
];

/** Ids de todos los elementos de un tipo, para editar sus propiedades en bloque desde el inspector. */
export function idsByKind(doc: EditorDocument, rooms: DerivedRoom[], kind: SelectableKind): string[] {
  const outdoor = (room: DerivedRoom) => room.wallIds.some((id) => id.startsWith('outdoor:'));
  switch (kind) {
    case 'walls': return doc.walls.filter((w) => !w.hidden).map((w) => w.id);
    case 'doors': return doc.openings.filter((o) => o.kind === 'puerta').map((o) => o.id);
    case 'windows': return doc.openings.filter((o) => o.kind === 'ventana').map((o) => o.id);
    case 'passages': return doc.openings.filter((o) => o.kind !== 'puerta' && o.kind !== 'ventana').map((o) => o.id);
    case 'rooms': return rooms.filter((r) => !outdoor(r)).map((r) => r.id);
    case 'patios': return rooms.filter(outdoor).map((r) => r.id);
    case 'furniture': return planObjects(doc).filter((o) => !isBoundary(o)).map((o) => o.id);
    case 'boundaries': return (doc.boundaries ?? []).map((b) => b.id);
    case 'columns': return (doc.columns ?? []).map((c) => c.id);
    case 'stairs': return (doc.stairs ?? []).map((s) => s.id);
    case 'ramps': return (doc.ramps ?? []).map((r) => r.id);
    case 'luminaires': return (doc.luminaires ?? []).map((l) => l.id);
    case 'labels': return doc.labels.map((l) => l.id);
  }
}
