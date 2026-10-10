import type { EditorDocument, Furniture } from '@/lib/editor-document/schema';
import { planObjects } from '@/lib/editor-document/boundary-types';
import { updateFurniture } from '@/lib/editor-document/spatial-commands';
import { assertSpatialPlacement, collisions, objectSolids, placementSolids } from './spatial-placement';
import { firstSolidContact } from './seating-drag';

/** Calcula obstáculos una vez por gesto y valida con las mismas excepciones que la colocación final. */
export function furnitureDragConstraint(doc: EditorDocument, id: string) {
  const items = planObjects(doc), original = items.find((item) => item.id === id);
  const family = new Set([id]);
  for (let added = true; added;) {
    added = false;
    for (const item of items) if (item.hostId && family.has(item.hostId) && !family.has(item.id)) { family.add(item.id); added = true; }
  }
  const children = items.filter((item) => item.id !== id && family.has(item.id));
  const obstacles = placementSolids(doc).filter((solid) => ![...family].some((key) => solid.id === key || solid.id.startsWith(`${key}:`)));
  const baseline = collisions(doc);
  return (from: Furniture, target: Furniture): Furniture => {
    if (!original) return target;
    const delta = { x: target.x - from.x, y: target.y - from.y }, length = Math.hypot(delta.x, delta.y);
    const at = (fraction: number): Furniture => ({ ...target, x: from.x + delta.x * fraction, y: from.y + delta.y * fraction });
    const valid = (item: Furniture) => {
      try {
        assertSpatialPlacement(doc, updateFurniture(doc, id, { x: item.x, y: item.y, rotation: item.rotation, elevationMm: item.elevationMm, hostId: item.hostId }), baseline);
        return true;
      } catch { return false; }
    };
    if (length < .001) return valid(target) ? target : from;
    const start = { ...target, x: from.x, y: from.y };
    const moving = [start, ...children.map((child) => ({ ...child, x: child.x + from.x - original.x, y: child.y + from.y - original.y,
      elevationMm: (child.elevationMm ?? 0) + (target.elevationMm ?? 0) - (original.elevationMm ?? 0) }))].flatMap(objectSolids);
    const contacts = [...new Set(moving.flatMap((a) => obstacles.map((b) => firstSolidContact(a, b, delta))).filter((fraction) => fraction < 1))].sort((a, b) => a - b);
    let safe = 0;
    // Se prueban entradas geométricas, no solo el destino: un salto no atraviesa una pared fina.
    for (const fraction of [...contacts.map((value) => Math.min(1, value + 2 / length)), 1]) {
      if (valid(at(fraction))) { safe = fraction; continue; }
      let blocked = fraction;
      for (let i = 0; i < 18 && (blocked - safe) * length > .1; i++) {
        const mid = (safe + blocked) / 2;
        if (valid(at(mid))) safe = mid; else blocked = mid;
      }
      return safe > 0 ? at(safe) : from;
    }
    return target;
  };
}
