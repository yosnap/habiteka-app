import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { walkthroughNavigation } from '@/lib/editor-document/walkthrough-navigation';
import { freeWalkStart, moveFreeWalk } from '@/lib/editor-document/free-walk-navigation';
import { upgradeConstructionDocument } from '@/lib/editor-document/migrations';
import { visualSampleDocument } from '@/app/dev/editor-v2/visual-sample';
import { autoTour } from '@/lib/editor-document/auto-tour';
import { buildWalkthrough } from '@/lib/editor-document/walkthrough-geometry';

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
  });

  it('se desliza por un muro sin penetrarlo al caminar en diagonal', () => {
    const nav = walkthroughNavigation(twoRooms());
    const end = moveFreeWalk(nav, { x: 2300, y: 700 }, { x: 1500, y: 1000 });
    expect(end.x).toBeLessThan(2800);
    expect(end.y).toBeGreaterThan(700);
    expect(nav.free(end)).toBe(true);
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
