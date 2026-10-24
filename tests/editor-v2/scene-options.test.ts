import { expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { addBuildingLevel, buildingDocuments } from '@/lib/editor-document/building-levels';
import {
  DEFAULT_SCENE_OPTIONS,
  explodedOffset,
  sceneLength,
  sceneOptionHiddenIds,
} from '@/components/editor-v2/workspace/scene-options-state';
import {
  findWalkablePath,
  walkthroughNavigation,
} from '@/lib/editor-document/walkthrough-navigation';
import { EDITOR_SHORTCUTS, plainShortcutFor } from '@/canvas/editor-v2/editor-shortcuts';

function room() {
  return addWallPath(
    emptyEditorDocument(),
    [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 4000 },
      { x: 0, y: 4000 },
    ],
    true,
  );
}
it('convierte medidas reales a pies sin cambiar la geometría', () => {
  expect(sceneLength(3048, 'imperial')).toBe('10.00 ft');
  expect(sceneLength(3048, 'metric')).toBe('3.05 m');
});
it('separa plantas según altura real sin modificar documento ni cotas', () => {
  const doc = addBuildingLevel(room(), true),
    before = JSON.stringify(doc);
  const levels = buildingDocuments(doc);
  expect(explodedOffset(doc, levels[0]!.id, true)).toBe(0);
  expect(explodedOffset(doc, levels[1]!.id, true)).toBe(4000);
  expect(explodedOffset(doc, levels[1]!.id, false)).toBe(0);
  expect(JSON.stringify(doc)).toBe(before);
});
it('ocultar muros incluye huecos sin convertir paredes en límites lógicos', () => {
  const doc = room();
  doc.openings.push({
    id: 'window',
    kind: 'ventana',
    wallId: doc.walls[0]!.id,
    position: 0.5,
    widthMm: 800,
    dimensionalOrigin: 'physical',
  });
  const before = JSON.stringify(doc);
  expect(sceneOptionHiddenIds(doc, { ...DEFAULT_SCENE_OPTIONS, walls: false })).toEqual(
    expect.arrayContaining([doc.walls[0]!.id, 'window']),
  );
  expect(sceneOptionHiddenIds(doc, DEFAULT_SCENE_OPTIONS)).toEqual([]);
  expect(JSON.stringify(doc)).toBe(before);
});
it('el comando K requiere modificador y no roba una letra de construcción', () => {
  expect(EDITOR_SHORTCUTS.commands.keys).toContain('k');
  expect(plainShortcutFor('k')).toBeUndefined();
});
it('un destino caminable respeta las colisiones en todos sus segmentos', () => {
  const nav = walkthroughNavigation(room()),
    from = { x: 800, y: 800 },
    to = { x: 3000, y: 3000 };
  const points = findWalkablePath(nav, from, to);
  expect(points.at(-1)).toEqual(to);
  expect(points.slice(1).every((point, index) => nav.segmentFree(points[index]!, point))).toBe(
    true,
  );
});
it('un clic al otro lado de una pared cerrada no crea un paso', () => {
  const doc = addWallPath(room(), [
    { x: 2000, y: 0 },
    { x: 2000, y: 4000 },
  ]);
  const nav = walkthroughNavigation(doc);
  expect(() => findWalkablePath(nav, { x: 800, y: 800 }, { x: 3000, y: 3000 })).toThrow();
});
