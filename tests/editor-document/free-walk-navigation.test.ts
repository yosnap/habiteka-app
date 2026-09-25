import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { walkthroughNavigation } from '@/lib/editor-document/walkthrough-navigation';
import { freeWalkStart, moveFreeWalk } from '@/lib/editor-document/free-walk-navigation';
import { upgradeConstructionDocument } from '@/lib/editor-document/migrations';
import { visualSampleDocument } from '@/app/dev/editor-v2/visual-sample';
import { autoTour } from '@/lib/editor-document/auto-tour';
import { buildWalkthrough } from '@/lib/editor-document/walkthrough-geometry';
import { addOutdoorArea } from '@/lib/editor-document/outdoor-area';
import { addRamp, addStair } from '@/lib/editor-document/construction-commands';
import { rampParts, rampPartFootprint } from '@/lib/editor-document/ramp-route';
import { stairLayout } from '@/lib/editor-document/stair-layout';
import { localToWorld } from '@/lib/editor-document/spatial-properties';
import { setFloorFinish } from '@/lib/editor-document/floor-finishes';

function twoRooms() {
  const doc = emptyEditorDocument();
  doc.vertices = [
    { id: 'a', x: 0, y: 0 }, { id: 'b', x: 3000, y: 0 }, { id: 'c', x: 6000, y: 0 },
    { id: 'd', x: 0, y: 4000 }, { id: 'e', x: 3000, y: 4000 }, { id: 'f', x: 6000, y: 4000 },
  ];
  doc.walls = [['a', 'b'], ['b', 'c'], ['d', 'e'], ['e', 'f'], ['a', 'd'], ['b', 'e'], ['c', 'f']]
    .map(([a, b], index) => ({ id: `w${index}`, startVertexId: a!, endVertexId: b!, thicknessMm: 150, dimensionalOrigin: 'physical' as const }));
  doc.openings = [{ id: 'door', wallId: 'w5', kind: 'puerta', position: .5, widthMm: 900,
    dimensionalOrigin: 'physical' }];
  return doc;
}

describe('paseo libre', () => {
  it('elige un punto transitable si la cámara de interior cae sobre un mueble', () => {
    const doc = twoRooms();
    doc.furniture = [{ id: 'box', kind: 'armario', x: 1300, y: 1600, widthMm: 500, depthMm: 500,
      rotation: 0, dimensionalOrigin: 'physical' }];
    const nav = walkthroughNavigation(doc);
    const start = freeWalkStart(nav, { x: 1500, y: 1800 });
    expect(start).not.toBeNull();
    expect(nav.free(start!)).toBe(true);
  });

  it('atraviesa una puerta abierta, pero se detiene ante una cerrada', () => {
    const doc = twoRooms();
    let nav = walkthroughNavigation(doc);
    expect(moveFreeWalk(nav, { x: 2000, y: 2000 }, { x: 2000, y: 0 }).x).toBeGreaterThan(3000);
    const closed = upgradeConstructionDocument(doc);
    closed.openings[0]!.openAngleDeg = 0;
    nav = walkthroughNavigation(closed);
    expect(moveFreeWalk(nav, { x: 2000, y: 2000 }, { x: 2000, y: 0 }).x).toBeLessThan(2800);
    const raisedDoor = upgradeConstructionDocument(twoRooms());
    raisedDoor.openings[0]!.elevationMm = 600;
    nav = walkthroughNavigation(raisedDoor);
    expect(moveFreeWalk(nav, { x: 2000, y: 2000 }, { x: 2000, y: 0 }).x).toBeLessThan(2800);
  });

  it('se desliza por un muro sin penetrarlo al caminar en diagonal', () => {
    const nav = walkthroughNavigation(twoRooms());
    const end = moveFreeWalk(nav, { x: 2300, y: 700 }, { x: 1500, y: 1000 });
    expect(end.x).toBeLessThan(2800);
    expect(end.y).toBeGreaterThan(700);
    expect(nav.free(end)).toBe(true);
  });

  it('sale por una puerta al patio y se detiene en su borde exterior', () => {
    const house = twoRooms();
    house.openings.push({ id: 'patio-door', wallId: 'w6', kind: 'puerta', position: .5, widthMm: 1000,
      dimensionalOrigin: 'physical' });
    const doc = addOutdoorArea(house, { x: 6000, y: 0 }, { x: 9000, y: 4000 });
    const nav = walkthroughNavigation(doc);
    const outside = moveFreeWalk(nav, { x: 5200, y: 2000 }, { x: 2300, y: 0 });
    expect(outside.x).toBeGreaterThan(6000);
    expect(nav.roomAt(outside)?.wallIds.some((id) => id.startsWith('outdoor:'))).toBe(true);
    const edge = moveFreeWalk(nav, outside, { x: 2500, y: 0 });
    expect(edge.x).toBeLessThanOrEqual(9000);
    expect(nav.free(edge)).toBe(true);
  });

  it('sube una rampa real y cruza su hueco elevado sin atravesar el muro', () => {
    const ramp = { id: 'ramp', catalogId: 'builtin:ramp-straight', x: 2400, y: 0,
      widthMm: 1200, depthMm: 4000, riseMm: 600, elevationMm: 0, rotation: 180,
      materialId: 'concrete-grey' };
    const doc = addRamp(twoRooms(), ramp);
    const nav = walkthroughNavigation(doc);
    const start = { x: 1800, y: -3800 };
    expect(nav.free(start)).toBe(true);
    const end = moveFreeWalk(nav, start, { x: 0, y: 5200 });
    expect(end.y).toBeGreaterThan(0);
    expect(nav.floorAt(end)).toBe(600);
    expect(nav.free(end)).toBe(true);
    expect(moveFreeWalk(nav, { x: 800, y: -300 }, { x: 0, y: 800 }).y).toBeLessThan(0);
  });

  it('sigue las dos pendientes y el descansillo de una rampa con giro', () => {
    const ramp = { id: 'routed', catalogId: 'builtin:ramp-straight', x: 0, y: 0,
      widthMm: 1200, depthMm: 4000, riseMm: 600, elevationMm: 0, rotation: 0,
      materialId: 'concrete-grey', route: { landingMm: 1200, turn: 'right' as const,
        secondDepthMm: 3000, secondRiseMm: 300 } };
    const doc = addRamp(emptyEditorDocument(), ramp);
    const nav = walkthroughNavigation(doc);
    const centers = rampParts(ramp).map((part) => {
      const corners = rampPartFootprint(ramp, part);
      return { x: corners.reduce((sum, p) => sum + p.x, 0) / 4,
        y: corners.reduce((sum, p) => sum + p.y, 0) / 4 };
    });
    expect(centers.map((point) => nav.floorAt(point))).toEqual([300, 600, 750]);
    expect(centers.every((point) => nav.free(point))).toBe(true);
  });

  it('sube y baja peldaños reales sin poder salir de lado en altura', () => {
    const doc = addStair(twoRooms(), { id: 'stair', kind: 'straight', catalogId: 'stair-straight',
      x: 1000, y: 500, widthMm: 1000, depthMm: 3000, heightMm: 900, elevationMm: 0,
      rotation: 0, stepCount: 6, materialId: 'wood-oak' });
    const nav = walkthroughNavigation(doc);
    const top = moveFreeWalk(nav, { x: 1500, y: 3700 }, { x: 0, y: -3200 });
    expect(top.y).toBeGreaterThanOrEqual(500);
    expect(top.y).toBeLessThan(700);
    expect(nav.floorAt(top)).toBe(900);
    const side = moveFreeWalk(nav, top, { x: 1000, y: 0 });
    expect(side.x).toBeLessThan(2000);
    const sideAtBottom = moveFreeWalk(nav, { x: 600, y: 3300 }, { x: 1000, y: 0 });
    expect(sideAtBottom.x).toBeLessThan(1000);
    const bottom = moveFreeWalk(nav, top, { x: 0, y: 3300 });
    expect(bottom.y).toBeGreaterThan(3500);
    expect(nav.floorAt(bottom)).toBe(0);
  });

  it.each(['L', 'U'] as const)('mantiene la cota de cada peldaño y descansillo en escalera %s', (kind) => {
    const stair = { id: `stair-${kind}`, kind, catalogId: `stair-${kind}`, x: 300, y: 400,
      widthMm: 2400, depthMm: 3000, heightMm: 1200, elevationMm: 0,
      rotation: 90, stepCount: 8, materialId: 'wood-oak' };
    const doc = addStair(emptyEditorDocument(), stair);
    const nav = walkthroughNavigation(doc);
    const parts = stairLayout(stair);
    for (const part of [...parts.steps, ...parts.landings]) {
      const center = localToWorld(stair, { x: part.x + part.widthMm / 2, y: part.y + part.depthMm / 2 });
      expect(nav.floorAt(center)).toBe(part.heightMm);
      expect(nav.free(center)).toBe(true);
    }
  });

  it('bloquea una escalera cuyos peldaños son demasiado altos para caminar', () => {
    const doc = addStair(twoRooms(), { id: 'steep', kind: 'straight', catalogId: 'stair-straight',
      x: 1000, y: 500, widthMm: 1000, depthMm: 3000, heightMm: 900, elevationMm: 0,
      rotation: 0, stepCount: 3, materialId: 'wood-oak' });
    const end = moveFreeWalk(walkthroughNavigation(doc), { x: 1500, y: 3700 }, { x: 0, y: -1000 });
    expect(end.y).toBeGreaterThanOrEqual(3500);
  });

  it('conecta una estancia baja con otra elevada por una escalera y su hueco', () => {
    const house = upgradeConstructionDocument(twoRooms());
    const raisedId = walkthroughNavigation(house).roomAt({ x: 4500, y: 2000 })!.id;
    const raised = setFloorFinish(house, raisedId, { elevationMm: 900 });
    raised.openings[0]!.elevationMm = 900;
    raised.openings[0]!.heightMm = 1800;
    const doc = addStair(raised, { id: 'connecting-stair', kind: 'straight', catalogId: 'stair-straight',
      x: 3000, y: 1500, widthMm: 1000, depthMm: 1800, heightMm: 900, elevationMm: 0,
      rotation: 90, stepCount: 6, materialId: 'wood-oak' });
    const nav = walkthroughNavigation(doc);
    const end = moveFreeWalk(nav, { x: 1000, y: 2000 }, { x: 3500, y: 0 });
    expect(end.x).toBeGreaterThan(3000);
    expect(nav.roomAt(end)?.id).toBe(raisedId);
    expect(nav.floorAt(end)).toBe(900);
    const back = moveFreeWalk(nav, end, { x: -3500, y: 0 });
    expect(back.x).toBeLessThan(3000);
    expect(nav.floorAt(back)).toBe(0);
  });

  it('crea una ruta guiada entre patio y estancia elevada por la rampa', () => {
    const patio = addOutdoorArea(twoRooms(), { x: 0, y: -4000 }, { x: 3000, y: 0 });
    const doc = addRamp(patio, { id: 'patio-ramp', catalogId: 'builtin:ramp-straight', x: 2400, y: 0,
      widthMm: 1200, depthMm: 4000, riseMm: 600, elevationMm: 0, rotation: 180,
      materialId: 'concrete-grey' });
    const nav = walkthroughNavigation(doc);
    const patioRoom = nav.roomAt({ x: 500, y: -2000 })!;
    const raisedRoom = nav.roomAt({ x: 1500, y: 2000 })!;
    const route = autoTour(doc, [patioRoom.id, raisedRoom.id]);
    expect(buildWalkthrough(doc, route).invalidSegments).toEqual([]);
    expect(route.waypoints.some((point) => point.y < 0)).toBe(true);
    expect(route.waypoints.some((point) => point.y > 0)).toBe(true);
  });

  it('prepara un recorrido por las cuatro estancias amuebladas de la muestra', () => {
    const doc = visualSampleDocument();
    const nav = walkthroughNavigation(doc);
    const route = autoTour(doc, nav.rooms.map((room) => room.id));
    const compiled = buildWalkthrough(doc, route);
    expect(compiled.invalidSegments).toEqual([]);
    expect(new Set(route.zoneIds)).toEqual(new Set(nav.rooms.map((room) => room.id)));
    expect(route.waypoints.length).toBeGreaterThan(4);
  });
});
