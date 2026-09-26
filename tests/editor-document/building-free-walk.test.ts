import { describe, expect, it } from 'vitest';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { addBuildingLevel, switchBuildingLevel } from '@/lib/editor-document/building-levels';
import { buildingStairLinks } from '@/lib/editor-document/building-stair-links';
import { buildingWalkNavigation, moveBuildingWalk } from '@/lib/editor-document/building-free-walk';
import { setRoomCeiling } from '@/lib/editor-document/ceiling-commands';
import { addStair } from '@/lib/editor-document/construction-commands';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { emptyEditorDocument, type EditorDocument } from '@/lib/editor-document/schema';
import { stairArrival } from '@/lib/editor-document/stair-arrival';
import { stairLayout } from '@/lib/editor-document/stair-layout';
import { localToWorld } from '@/lib/editor-document/spatial-properties';
import { moveFreeWalk } from '@/lib/editor-document/free-walk-navigation';
import { setFloorFinish } from '@/lib/editor-document/floor-finishes';

const stair = { id: 'stairs', kind: 'straight' as const, catalogId: 'stair-straight',
  x: 1000, y: 1000, widthMm: 1000, depthMm: 2500, heightMm: 2700,
  elevationMm: 0, rotation: 0, stepCount: 15, materialId: 'wood-oak' };

function building(): EditorDocument {
  const room = addWallPath(emptyEditorDocument(), [
    { x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 0, y: 4000 },
  ], true);
  const upper = addBuildingLevel(room, true);
  const lower = switchBuildingLevel(upper, upper.levels![0]!.id);
  const withCeiling = setRoomCeiling(lower, deriveRooms(lower)[0]!.id);
  return addStair(withCeiling, stair);
}

describe('enlace físico entre plantas', () => {
  it('solo une una escalera con el suelo de la planta contigua si existe salida libre', () => {
    const doc = building(), links = buildingStairLinks(doc);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ lowerLevelId: doc.activeLevelId,
      upperLevelId: doc.levels![1]!.id, stairId: stair.id, arrival: { x: 1500, y: 1000 } });
    const wrongHeight = structuredClone(doc);
    wrongHeight.stairs![0]!.heightMm = 2500;
    expect(buildingStairLinks(wrongHeight)).toEqual([]);
    const blocked = structuredClone(doc);
    blocked.levels![1]!.document!.furniture.push({ id: 'blocking', kind: 'armario', x: 900, y: 400,
      widthMm: 1200, depthMm: 500, heightMm: 1800, elevationMm: 0, color: '#8ea69b',
      rotation: 0, dimensionalOrigin: 'physical' });
    expect(buildingStairLinks(blocked)).toEqual([]);
    const raised = structuredClone(doc), upper = raised.levels![1]!.document!;
    raised.levels![1]!.document = setFloorFinish(upper, deriveRooms(upper)[0]!.id, { elevationMm: 300 });
    expect(buildingStairLinks(raised)).toEqual([]);
  });

  it('abre la misma huella en el forjado superior sin tocar el documento', () => {
    const doc = building(), snapshot = structuredClone(doc), link = buildingStairLinks(doc)[0]!;
    const upper = doc.levels![1]!.document!;
    const floor = editorDocumentToScene(upper, [link.outline]).polygons.find((polygon) => polygon.role === 'floor')!;
    expect(floor.holes).toHaveLength(1);
    expect(floor.holes![0]!.map((point) => [point.x, point.y])).toEqual(expect.arrayContaining([[1, 1], [2, 3.5]]));
    expect(doc).toEqual(snapshot);
  });

  it('sube, cambia de planta sin salto de altura y desciende por el mismo hueco', () => {
    const doc = building(), nav = buildingWalkNavigation(doc);
    let state = { levelId: doc.activeLevelId!, point: { x: 1500, y: 3700 } };
    expect(nav.navs.get(state.levelId)!.free(state.point)).toBe(true);
    for (let i = 0; i < 80 && state.levelId === doc.activeLevelId; i++)
      state = moveBuildingWalk(nav, state, { x: 0, y: -80 });
    expect(state.levelId).toBe(doc.levels![1]!.id);
    expect(state.point.y).toBeCloseTo(970);
    const upperHeight = nav.levels[1]!.elevationMm + nav.navs.get(state.levelId)!.floorAt(state.point);
    expect(upperHeight).toBe(2700);
    for (let i = 0; i < 80 && state.levelId !== doc.activeLevelId; i++)
      state = moveBuildingWalk(nav, state, { x: 0, y: 80 });
    expect(state.levelId).toBe(doc.activeLevelId);
    expect(state.point.y).toBeCloseTo(1030);
    expect(nav.navs.get(state.levelId)!.floorAt(state.point)).toBe(2700);
  });

  it('conserva el cambio de planta con un paso largo de cámara', () => {
    const doc = building(), nav = buildingWalkNavigation(doc);
    const lower = { levelId: doc.activeLevelId!, point: { x: 1500, y: 1080 } };
    expect(nav.navs.get(lower.levelId)!.floorAt(lower.point)).toBe(2700);
    const upper = moveBuildingWalk(nav, lower, { x: 0, y: -500 });
    expect(upper.levelId).toBe(doc.levels![1]!.id);
    const back = moveBuildingWalk(nav, upper, { x: 0, y: 500 });
    expect(back.levelId).toBe(doc.activeLevelId);
  });

  it.each(['L', 'U'] as const)('enlaza el último tramo de escalera %s con la planta superior', (kind) => {
    const room = addWallPath(emptyEditorDocument(), [
      { x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 6000 }, { x: 0, y: 6000 },
    ], true);
    const upper = addBuildingLevel(room, true);
    const lower = switchBuildingLevel(upper, upper.levels![0]!.id);
    const angled = { ...stair, kind, x: 500, y: 500, widthMm: 2400, depthMm: 3000 };
    const doc = addStair(lower, angled), context = buildingWalkNavigation(doc);
    const arrival = stairArrival(angled);
    expect(context.links).toHaveLength(1);
    const layout = stairLayout(angled), split = Math.floor((angled.stepCount - 1) / 2);
    const centers = [...layout.steps.slice(0, split), ...layout.landings, ...layout.steps.slice(split)]
      .map((part) => localToWorld(angled, { x: part.x + part.widthMm / 2, y: part.y + part.depthMm / 2 }));
    const lowerNav = context.navs.get(doc.activeLevelId!)!;
    let climbed = centers[0]!;
    for (const center of centers.slice(1)) {
      climbed = moveFreeWalk(lowerNav, climbed, { x: center.x - climbed.x, y: center.y - climbed.y });
      expect(Math.hypot(center.x - climbed.x, center.y - climbed.y)).toBeLessThan(40);
    }
    const nearTop = { x: arrival.point.x - arrival.direction.x * 30,
      y: arrival.point.y - arrival.direction.y * 30 };
    expect(context.navs.get(doc.activeLevelId!)!.floorAt(nearTop)).toBe(2700);
    const result = moveBuildingWalk(context, { levelId: doc.activeLevelId!, point: nearTop },
      { x: arrival.direction.x * 80, y: arrival.direction.y * 80 });
    expect(result.levelId).toBe(doc.levels![1]!.id);
    expect(context.levels[1]!.elevationMm + context.navs.get(result.levelId)!.floorAt(result.point)).toBe(2700);
  });
});
