import { expect, it } from 'vitest';
import { addFurniture, addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { collisions, placeNewObject } from '@/canvas/editor-v2/spatial-placement';
import { furnitureDragConstraint } from '@/canvas/editor-v2/constrained-furniture-drag';
import { walkthroughNavigation } from '@/lib/editor-document/walkthrough-navigation';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';

const house = () => upgradeSpatialDocument(addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 10000 }, { x: 0, y: 10000 }], true));
const make = (id: string, x = 2000, y = 2000) => addFurniture(upgradeSpatialDocument(emptyEditorDocument()), getFurnitureCatalogEntry(id)!, { x, y }).furniture[0]!;

it.each(['habiteka:model:alfombra_yute_rectangular_base', 'habiteka:model:felpudo_coco_base'])('coloca y arrastra muebles sobre %s con identidades que contienen dos puntos', catalogId => {
  const doc = house();
  const covering = { ...make(catalogId), id: 'furniture:rug' };
  const cabinet = { ...make('habiteka:furniture:mueble-tv'), id: 'furniture:cabinet' };
  doc.furniture = [covering, cabinet];
  expect(collisions(doc).size).toBe(0);
  const before = { ...doc, furniture: [covering] };
  expect(placeNewObject(before, doc, cabinet.id).furniture.find(i => i.id === cabinet.id)).toMatchObject({ x: cabinet.x, y: cabinet.y });
  const source = { ...cabinet, x: 5000 };
  const moving = { ...doc, furniture: [covering, source] };
  expect(furnitureDragConstraint(moving, cabinet.id)(source, cabinet)).toMatchObject({ x: cabinet.x, y: cabinet.y });
  const onlyCovering = { ...doc, furniture: [covering] };
  expect(walkthroughNavigation(onlyCovering).free({ x: covering.x + covering.widthMm / 2, y: covering.y + covering.depthMm / 2 })).toBe(true);
  const intoWall = { ...doc, furniture: [{ ...covering, x: -50 }, cabinet] };
  expect(collisions(intoWall).size).toBeGreaterThan(0);
});

it('un felpudo fino admite el barrido de puerta sin permitir un mueble en él', () => {
  const doc = house(); const wall = doc.walls[0]!;
  doc.openings = [{ id: 'door:entrance', wallId: wall.id, kind: 'puerta', position: .5, widthMm: 1000,
    openAngleDeg: 90, dimensionalOrigin: 'physical' }];
  const mat = { ...make('habiteka:model:felpudo_coco_base', 4800, 120), id: 'furniture:mat' };
  doc.furniture = [mat];
  expect(collisions(doc).size).toBe(0);
  doc.furniture = [{ ...mat, heightMm: 400 }];
  expect(collisions(doc).size).toBeGreaterThan(0);
});

it('la sombrilla permite ocupar el aire bajo su lona, pero conserva la colisión del poste', () => {
  const doc = house(); const umbrella = make('habiteka:model:sombrilla_grande_base');
  const clear = { x: umbrella.x + umbrella.widthMm * .15, y: umbrella.y + umbrella.depthMm * .15 };
  const center = { x: umbrella.x + umbrella.widthMm / 2, y: umbrella.y + umbrella.depthMm / 2 };
  doc.furniture = [umbrella];
  const nav = walkthroughNavigation(doc);
  expect(nav.free(clear)).toBe(true);
  expect(nav.free(center)).toBe(false);
  const box = { id: 'small', kind: 'box', ...clear, widthMm: 200, depthMm: 200, heightMm: 500,
    elevationMm: 0, rotation: 0, dimensionalOrigin: 'physical' as const };
  expect(collisions({ ...doc, furniture: [umbrella, box] }).size).toBe(0);
  expect(collisions({ ...doc, furniture: [umbrella, { ...box, ...center }] }).size).toBeGreaterThan(0);
});

it('la hamaca permite pasar junto al tejido sin atravesar su asiento', () => {
  const doc = house(); const hammock = make('habiteka:model:hamaca_soporte_madera_base');
  doc.furniture = [hammock]; const nav = walkthroughNavigation(doc);
  expect(nav.free({ x: hammock.x + hammock.widthMm * .02, y: hammock.y + hammock.depthMm * .02 })).toBe(true);
  expect(nav.free({ x: hammock.x + hammock.widthMm / 2, y: hammock.y + hammock.depthMm / 2 })).toBe(false);
});
