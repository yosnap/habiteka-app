import type { EditorDocument, Furniture } from './schema';
import { deriveRoomsSafe } from './rooms';
import { floorFinish } from './floor-finishes';
import { insideRoom } from './ceiling-geometry';
import { objectCenter } from './spatial-properties';
import { getFurnitureCatalogEntry } from './furniture-catalog';
import { restOnHost } from './object-host-rest';

/**
 * Los muebles se apoyan en el suelo de su estancia: si la estancia tiene el suelo elevado (forjado a 1,00 m, por
 * ejemplo), un objeto a cota 0 quedaría enterrado e invisible en 3D. Se conserva la elevación propia del catálogo
 * (una lámpara de mesa, un monitor) sumada a la cota del suelo. Nunca baja un objeto colocado más alto a mano.
 * Los muebles de cocina se apoyan igual: encimera y módulos altos suben con el suelo de la estancia. Un objeto sobre
 * otro mueble (televisor sobre mueble, microondas sobre encimera) se apoya antes en su anfitrión y sigue a su altura.
 */
export function restObjectsOnFloors(doc: EditorDocument): EditorDocument {
  const rooms = deriveRoomsSafe(doc);
  if (!rooms.length) return doc;
  let changed = false;
  const rest = <T extends Furniture>(item: T): T => {
    const room = rooms.find((candidate) => insideRoom(objectCenter(item), candidate.boundary));
    if (!room) return item;
    const floor = floorFinish(doc, room.id).elevationMm ?? 0;
    const minimum = floor + (getFurnitureCatalogEntry(item.catalogId)?.elevationMm ?? 0);
    if ((item.elevationMm ?? 0) >= minimum) return item;
    changed = true;
    return { ...item, elevationMm: minimum };
  };
  const furniture = doc.furniture.map((item) => { const hosted = restOnHost(doc, item); if (hosted !== item) changed = true; return rest(hosted); });
  const kitchenRuns = doc.kitchenRuns?.map(rest);
  return changed ? { ...doc, furniture, ...(kitchenRuns ? { kitchenRuns } : {}) } : doc;
}
