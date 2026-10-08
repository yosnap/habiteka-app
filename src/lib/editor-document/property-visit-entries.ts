import type { EditorDocument } from './schema';
import { buildingDocuments } from './building-levels';
import { eligibleCeilingRooms, insideRoom } from './ceiling-geometry';
import { walkthroughNavigation } from './walkthrough-navigation';
import { wallPath } from './wall-path';
import type { PropertyVisitEntry } from './property-visit-types';
import { walkthroughBlockReport } from './walkthrough-block-report';

/** Candidatos, nunca una elección implícita de la entrada principal. Conserva los bloqueados para explicar el motivo. */
export function propertyVisitEntries(document: EditorDocument): PropertyVisitEntry[] {
  return buildingDocuments(document).filter(level => level.elevationMm === 0).flatMap(level => {
    const doc = level.document, nav = walkthroughNavigation(doc);
    const indoor = new Set(eligibleCeilingRooms(doc).map(room => room.id));
    return doc.openings.flatMap((opening, index): PropertyVisitEntry[] => {
      if (opening.kind === 'ventana') return [];
      const wall = doc.walls.find(item => item.id === opening.wallId);
      if (!wall || wall.hidden) return [];
      const path = wallPath(doc, wall), center = path.at(opening.position), tangent = path.tangent(opening.position);
      const offset = wall.thicknessMm / 2 + 250;
      for (const sign of [-1, 1]) {
        const inside = { x: center.x + tangent.y * offset * sign, y: center.y - tangent.x * offset * sign };
        const nearOutside = { x: center.x - tangent.y * offset * sign, y: center.y + tangent.x * offset * sign };
        const room = nav.roomAt(inside), other = nav.roomAt(nearOutside);
        if (!room || !indoor.has(room.id) || (other && indoor.has(other.id))) continue;
        const name = doc.labels.find(label => insideRoom(label, room.boundary))?.text ?? `Estancia ${nav.rooms.indexOf(room) + 1}`;
        // Hasta dos metros antes del umbral, solo sobre superficies ya transitables.
        let outside = nearOutside;
        for (const reach of [750, 1250, 2000]) {
          const candidate = { x: center.x - tangent.y * reach * sign, y: center.y + tangent.x * reach * sign };
          if (!nav.roomAt(candidate) || !indoor.has(nav.roomAt(candidate)!.id)) {
            if (nav.segmentFree(candidate, nearOutside)) outside = candidate;
          }
        }
        const block = nav.segmentBlock(outside, inside);
        const report = block ? walkthroughBlockReport(doc, block) : null;
        const issue = block ? block.kind === 'outside'
          ? 'Falta suelo transitable en el acceso exterior. El terreno visual no acredita un paso.'
          : `${report!.cause} ${report!.action}` : undefined;
        const source = other ? doc.labels.find(label => insideRoom(label, other.boundary))?.text ?? 'Zona exterior del plano' : 'Exterior';
        return [{ id: opening.id, label: `Acceso ${index + 1}: ${source} → ${name}`, levelId: level.id, roomId: room.id, outside, inside, issue }];
      }
      return [];
    });
  });
}
