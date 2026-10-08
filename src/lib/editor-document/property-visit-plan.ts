import type { EditorDocument } from './schema';
import { buildingDocuments } from './building-levels';
import { deriveRooms } from './rooms';
import { insideRoom } from './ceiling-geometry';
import { distance } from './geometry';
import { walkthroughNavigation } from './walkthrough-navigation';
import { propertyVisitEntries } from './property-visit-entries';
import { propertyVisitPaths } from './property-visit-paths';
import { propertyVisitFrames } from './property-visit-frames';
import type { PropertyVisitPlan } from './property-visit-types';
import { compactPropertyVisit } from './property-visit-compact';

/** Todas las zonas permanecen en el informe, incluso cuando no se puede llegar a ellas. No modifica el plano. */
export function planPropertyVisit(document: EditorDocument, entryId?: string): PropertyVisitPlan {
  const levels = buildingDocuments(document);
  const coverage = levels.flatMap(level => deriveRooms(level.document).map((room, index) => ({
    id: `${level.id}:${room.id}`, roomId: room.id, levelId: level.id,
    name: level.document.labels.find(label => insideRoom(label, room.boundary))?.text ?? `Zona sin etiqueta ${index + 1}`,
    status: 'pending' as 'pending' | 'planned', issue: 'Pendiente de conectar con la entrada.',
  })));
  const plan: PropertyVisitPlan = { entry: null, coverage, frames: [], durationSeconds: 0, issues: [], complete: false };
  const entries = propertyVisitEntries(document), entry = entries.find(item => item.id === entryId);
  if (!entry) { plan.issues.push(entries.length ? 'Elige el acceso por el que comienza la visita.' : 'No se ha identificado un acceso exterior conectado con un interior. Revisa las puertas y el suelo del acceso.'); return plan; }
  plan.entry = entry;
  if (entry.issue) { plan.issues.push(entry.issue); return plan; }
  const level = levels.find(item => item.id === entry.levelId)!, doc = level.document;
  const nav = walkthroughNavigation(doc);
  let paths = propertyVisitPaths(nav, entry.inside);
  // Un paso válido puede quedar entre dos líneas de la malla gruesa. Afinar sin reducir el margen de colisión.
  if (!paths.limited && nav.rooms.some(room => !paths.reached.some(node => insideRoom(node.point, room.boundary))))
    paths = propertyVisitPaths(nav, entry.inside, 75);
  if (paths.limited) plan.issues.push('El análisis alcanzó su límite de búsqueda. Las zonas pendientes necesitan un trazado manual; no se dan por visitadas.');
  const pending = nav.rooms.map(room => {
    const points = paths.reached.filter(node => insideRoom(node.point, room.boundary));
    const center = { x: room.boundary.reduce((sum, p) => sum + p.x, 0) / room.boundary.length,
      y: room.boundary.reduce((sum, p) => sum + p.y, 0) / room.boundary.length };
    points.sort((a, b) => distance(a.point, center) - distance(b.point, center));
    return { room, target: points[0] };
  });
  const camera = propertyVisitFrames(nav, level.id, entry.outside,
    Math.atan2(entry.inside.x - entry.outside.x, entry.inside.y - entry.outside.y) * 180 / Math.PI);
  camera.move([entry.inside], 'Cruzar el acceso real');
  let current = paths.reached.find(node => node.id === '0,0')!;
  const reachable = pending.filter(item => item.target);
  while (reachable.length) {
    reachable.sort((a, b) => distance(a.target!.point, current.point) - distance(b.target!.point, current.point));
    const item = reachable.shift()!, target = item.target!;
    const row = coverage.find(zone => zone.levelId === level.id && zone.roomId === item.room.id)!;
    camera.move(paths.between(current.id, target.id), `Llegar a ${row.name}`);
    camera.inspect(row.name);
    row.status = 'planned'; row.issue = '';
    current = target;
  }
  for (const row of coverage.filter(zone => zone.status === 'pending')) {
    row.issue = row.levelId !== level.id
      ? 'Falta enlazar esta planta mediante una escalera verificada en la visita completa.'
      : 'No se encontró un paso transitable desde la entrada. Revisa puertas, muebles, altura libre y suelo; no se omite esta zona.';
  }
  plan.frames = camera.frames;
  plan.durationSeconds = camera.frames.reduce((sum, frame) => sum + frame.secondsFromPrevious, 0);
  const missing = coverage.filter(zone => zone.status === 'pending');
  if (missing.length) plan.issues.push(`Quedan ${missing.length} zonas sin recorrido. No se puede preparar el vídeo completo.`);
  plan.complete = coverage.length > 0 && missing.length === 0 && !paths.limited;
  return compactPropertyVisit(plan);
}
