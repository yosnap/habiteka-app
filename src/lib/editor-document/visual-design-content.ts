import { sameDesignContent } from './approved-design';
import type { EditorDocument } from './schema';
import { deriveRoomsSafe } from './rooms';
import { pointInPolygon } from './polygon-tools';

/**
 * Un rótulo nombra la estancia que lo contiene: moverlo dentro de ella no cambia el diseño. Se compara esa estancia y
 * no el punto exacto; los rótulos fuera de cualquier estancia conservan su posición.
 */
function labelsByRoom(doc: EditorDocument) {
  const rooms = deriveRoomsSafe(doc);
  return doc.labels.map(({ x, y, ...label }) => {
    const room = rooms.find((candidate) => pointInPolygon({ x, y }, candidate.boundary));
    return room ? { ...label, roomId: room.id } : { ...label, x, y };
  });
}

/**
 * Lo que no cambia el aspecto de las imágenes: rutas, comentarios, el nombre de las zonas, el uso declarado del espacio
 * (solo condiciona el prompt) y la posición de cada rótulo dentro de su estancia. De cada zona se conservan su contorno
 * y su acabado de suelo, que sí se ven.
 */
export function withoutNonVisual(doc: EditorDocument): EditorDocument {
  const zones = (doc.designZones ?? []).map(({ polygon, floorFinish }) => ({ polygon, floorFinish }));
  return { ...doc, labels: labelsByRoom(doc), walkthroughs: [], comments: [], designZones: zones,
    designSpaceKind: undefined } as unknown as EditorDocument;
}

export function sameVisualDesignContent(first: EditorDocument, second: EditorDocument): boolean {
  return sameDesignContent(withoutNonVisual(first), withoutNonVisual(second));
}
