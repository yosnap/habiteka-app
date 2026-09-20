import { describe, expect, it } from 'vitest';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { wallDimensionLayout } from '@/canvas/editor-v2/dimension-layout';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { applyCommand } from '@/lib/editor-document/commands';

describe('architectural dimension layout', () => {
  it('places all rectangle dimensions outside regardless of each wall orientation', () => {
    let doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 },
      { x: 5000, y: 5000 }, { x: 0, y: 5000 }], true);
    doc = applyCommand(doc, { type: 'invert-wall', wallId: doc.walls[3]!.id });
    const layouts = doc.walls.map((wall) => wallDimensionLayout(doc, wall, deriveRooms(doc), .1));
    expect(layouts[0]!.from.y).toBeLessThan(0);
    expect(layouts[1]!.from.x).toBeGreaterThan(5000);
    expect(layouts[2]!.from.y).toBeGreaterThan(5000);
    expect(layouts[3]!.from.x).toBeLessThan(0);
  });
  it('keeps offset at 36 screen pixels beyond half the wall thickness', () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }]);
    for (const scale of [.05, .1, .3]) {
      const layout = wallDimensionLayout(doc, doc.walls[0]!, [], scale);
      expect((Math.abs(layout.from.y) - 75) * scale).toBeCloseTo(36);
    }
  });
  it('keeps open wall annotation on the same side after inversion', () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 0, y: 5000 }]);
    const inverted = applyCommand(doc, { type: 'invert-wall', wallId: doc.walls[0]!.id });
    expect(wallDimensionLayout(doc, doc.walls[0]!, [], .1).from.x)
      .toBe(wallDimensionLayout(inverted, inverted.walls[0]!, [], .1).from.x);
  });
});
