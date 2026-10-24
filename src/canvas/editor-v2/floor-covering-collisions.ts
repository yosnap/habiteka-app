import type { EditorDocument } from '@/lib/editor-document/schema';
import { planObjects } from '@/lib/editor-document/boundary-types';
import { isFloorCovering } from './wall-back-alignment';

/** Identidades completas: «furniture:uuid» también es un id, no el prefijo de un sólido. */
export function floorCoveringOverlapPolicy(doc: EditorDocument) {
  const items = planObjects(doc);
  const coverings = new Set(items.filter(isFloorCovering).map(item => item.id));
  const objects = new Set([...items, ...(doc.stairs ?? []), ...(doc.ramps ?? []), ...(doc.columns ?? [])].map(item => item.id));
  const doors = new Set(doc.openings.filter(item => item.kind === 'puerta').map(item => item.id));
  type Solid = { id: string; bottom: number; top: number };
  const allows = (covering: Solid, other: Solid) => coverings.has(covering.id)
    && (objects.has(other.id) || doors.has(other.id) && covering.top <= other.bottom + 30);
  return (a: Solid, b: Solid) => allows(a, b) || allows(b, a);
}
