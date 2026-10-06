import type { EditorDocument } from './schema';
import type { DerivedRoom } from './rooms';
import { getFurnitureCatalogEntry } from './furniture-catalog';
import { isTelevision } from './native-design-seating';
import { objectCenter } from './spatial-properties';
import { pointInPolygon } from './polygon-tools';

/** Amueblar añade objetos: una pantalla existente ya satisface el conjunto de TV de su estancia. */
export function hasRoomTelevision(doc: EditorDocument, roomId: string | undefined, rooms: readonly DerivedRoom[]): boolean {
  const room = rooms.find(item => item.id === roomId);
  return !!room && doc.furniture.some(item => isTelevision(getFurnitureCatalogEntry(item.catalogId ?? ''))
    && pointInPolygon(objectCenter(item), room.boundary));
}
