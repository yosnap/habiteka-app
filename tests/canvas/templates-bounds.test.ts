import { describe, expect, it } from 'vitest';
import { BUILTIN_TEMPLATES } from '@/canvas/templates';
import { selectionAabb } from '@/canvas/floating-menu-anchor';

describe('plantillas habitables', () => {
  it('no superpone sofá y sillas del comedor', () => {
    const doc = BUILTIN_TEMPLATES.find((t) => t.id === 'salon-comedor')!.doc;
    const sofa = doc.objects.find((o) => o.kind === 'sofa')!;
    const a = selectionAabb([sofa], [sofa.id])!;
    for (const chair of doc.objects.filter((o) => o.kind === 'silla')) {
      const b = selectionAabb([chair], [chair.id])!;
      const overlap =
        a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
      expect(overlap, chair.id).toBe(false);
    }
  });
  it('mantiene sofá y sillas girados dentro de la sala', () => {
    const doc = BUILTIN_TEMPLATES.find((t) => t.id === 'salon-comedor')!.doc;
    const walls = doc.objects.filter((o) => o.kind === 'wall');
    const room = selectionAabb(
      walls,
      walls.map((o) => o.id),
    )!;
    for (const obj of doc.objects.filter((o) => o.kind !== 'wall')) {
      const bounds = selectionAabb([obj], [obj.id])!;
      expect(bounds.x, obj.id).toBeGreaterThanOrEqual(room.x);
      expect(bounds.y, obj.id).toBeGreaterThanOrEqual(room.y);
      expect(bounds.x + bounds.width, obj.id).toBeLessThanOrEqual(room.x + room.width);
      expect(bounds.y + bounds.height, obj.id).toBeLessThanOrEqual(room.y + room.height);
    }
  });
});
