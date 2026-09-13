import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SURFACE_MATERIALS, surfaceMaterial } from '@/lib/editor-document/surface-materials';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { setWallSurface } from '@/lib/editor-document/spatial-commands';
import { setFloorFinish } from '@/lib/editor-document/floor-finishes';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { WALL_PLAN_COLOR } from '@/lib/editor-document/wall-appearance';
import { createEditorStore } from '@/canvas/editor-v2/store';

const room = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 4000 }, { x: 0, y: 4000 }], true);
describe('local surface material library', () => {
  it('contains 60 unique CC0 materials with verified local PBR maps', () => {
    expect(SURFACE_MATERIALS).toHaveLength(60);
    expect(new Set(SURFACE_MATERIALS.map((m) => m.id)).size).toBe(60);
    for (const material of SURFACE_MATERIALS) {
      expect(material.license).toBe('CC0-1.0');
      expect(material.sizeMm.every((n) => Number.isFinite(n) && n >= 50 && n <= 10000)).toBe(true);
      expect(readFileSync(`public${material.preview}`).length).toBeGreaterThan(100);
      for (const key of ['color', 'normal', 'roughness'] as const) {
        const bytes = readFileSync(`public${material.maps[key]}`);
        expect(createHash('md5').update(bytes).digest('hex')).toBe(material.provenance[key].md5);
      }
    }
    expect(surfaceMaterial('https://untrusted.invalid/image.jpg')).toBeUndefined();
  });
  it('keeps wall faces independent, corners covered and tops structural', () => {
    const source = room(), id = source.walls[0]!.id;
    const first = setWallSurface(source, id, 'left', 'polyhaven:wood_floor');
    const second = setWallSurface(first, id, 'right', 'polyhaven:marble_01');
    expect(source.walls[0]!.materials).toBeUndefined();
    expect(second.walls[0]!.materials).toEqual({ left: 'polyhaven:wood_floor', right: 'polyhaven:marble_01' });
    const scene = editorDocumentToScene(second);
    expect(scene.boxes.find((b) => b.sourceEntityId === id)!.sideMaterials).toEqual(['polyhaven:wood_floor', 'polyhaven:marble_01']);
    expect(scene.boxes.find((b) => b.sourceEntityId === id)!.topColor).toBe(WALL_PLAN_COLOR);
    expect(scene.polygons.flatMap((p) => p.edgeFinishes ?? []).some((f) => f.materialId === 'polyhaven:wood_floor')).toBe(true);
    expect(setWallSurface(second, id, 'left').walls[0]!.materials!.right).toBe('polyhaven:marble_01');
    expect(() => setWallSurface(source, id, 'left', 'unknown')).toThrow();
  });
  it('persists floor texture scale and rotation with undo and redo', () => {
    const source = room(), id = deriveRooms(source)[0]!.id, store = createEditorStore(source);
    const next = setFloorFinish(source, id, { texture: 'polyhaven:marble_01', tileSizeMm: 1500, rotation: 25 });
    expect(parseEditorDocument(JSON.parse(JSON.stringify(next)))).toEqual(next);
    store.getState().apply(next); store.getState().undo(); expect(store.getState().document).toEqual(source);
    store.getState().redo(); expect(store.getState().document).toEqual(next);
    expect(() => setFloorFinish(source, id, { texture: 'polyhaven:unknown' })).toThrow();
  });
});
