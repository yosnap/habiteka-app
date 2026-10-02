import { expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { addOutdoorArea } from '@/lib/editor-document/outdoor-area';
import { addLinearBoundary } from '@/lib/editor-document/linear-boundary';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { setOpeningConstruction, setWallConstruction } from '@/lib/editor-document/construction-commands';
import { setFloorFinish, floorFinish } from '@/lib/editor-document/floor-finishes';
import { updateBoundary, addBoundaryGate } from '@/lib/editor-document/boundary-commands';
import { bulkPeers, propagateToPeers } from '@/lib/editor-document/bulk-edit';
import { applyKindSelection, idsByKind } from '@/canvas/editor-v2/select-by-kind';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { addBuildingLevel, switchBuildingLevel } from '@/lib/editor-document/building-levels';
import { wallConstruction } from '@/lib/editor-document/construction-properties';

const house = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 4000 }, { x: 0, y: 4000 }], true);

it('incluye la tira LED exterior en la selección de luces', () => {
  const doc = emptyEditorDocument();
  doc.furniture.push({ id: 'led-terraza', catalogId: 'habiteka:outdoor:tira-led', kind: 'tira-led',
    x: 1000, y: 1000, widthMm: 2000, depthMm: 25, heightMm: 15, rotation: 0,
    elevationMm: 0, dimensionalOrigin: 'physical' });
  expect(idsByKind(doc, [], 'luminaires')).toEqual(['led-terraza']);
});

it('la altura cambiada en una pared se repite en las demás paredes seleccionadas, no en otros tipos', () => {
  const doc = house();
  const walls = idsByKind(doc, deriveRooms(doc), 'walls');
  expect(walls).toHaveLength(4);
  const selection = [...walls, deriveRooms(doc)[0]!.id];
  const peers = bulkPeers(doc, walls[0]!, selection);
  expect(peers).toEqual(walls.slice(1));
  const next = propagateToPeers(doc, setWallConstruction(doc, walls[0]!, { heightMm: 3200 } as Parameters<typeof setWallConstruction>[2]), walls[0]!, peers);
  expect(next.walls.every((w) => wallConstruction(w).heightMm === 3200)).toBe(true);
});

it('altura y elevación de una ventana se propagan a todas las ventanas seleccionadas', () => {
  let doc = house();
  const wall = doc.walls[0]!;
  doc = { ...doc, openings: [.25, .5, .75].map((position, i) => ({ id: `v${i}`, wallId: wall.id, kind: 'ventana', position, widthMm: 1000, dimensionalOrigin: 'physical' } as (typeof doc.openings)[number])) };
  const windows = idsByKind(doc, [], 'windows');
  const next = propagateToPeers(doc, setOpeningConstruction(doc, 'v0', { heightMm: 1500, elevationMm: 1100 }), 'v0', bulkPeers(doc, 'v0', windows));
  expect(next.openings.map((o) => [o.heightMm, o.elevationMm])).toEqual([[1500, 1100], [1500, 1100], [1500, 1100]]);
});

it('la cota del suelo se propaga a todas las estancias y patios seleccionados', () => {
  const doc = addOutdoorArea(house(), { x: 8000, y: 0 }, { x: 11000, y: 4000 });
  const rooms = deriveRooms(doc).map((r) => r.id);
  expect(idsByKind(doc, deriveRooms(doc), 'floors')).toEqual(rooms);
  const next = propagateToPeers(doc, setFloorFinish(doc, rooms[0]!, { elevationMm: 300 }), rooms[0]!, bulkPeers(doc, rooms[0]!, rooms));
  expect(rooms.map((id) => floorFinish(next, id).elevationMm)).toEqual([300, 300]);
});

it('selecciona todos los suelos de la planta activa y permite editar sus acabados juntos', () => {
  const doc = emptyEditorDocument();
  doc.vertices = [
    { id: 'a', x: 0, y: 0 }, { id: 'b', x: 3000, y: 0 }, { id: 'c', x: 6000, y: 0 },
    { id: 'd', x: 6000, y: 4000 }, { id: 'e', x: 3000, y: 4000 }, { id: 'f', x: 0, y: 4000 },
  ];
  doc.walls = [
    ['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f'], ['f', 'a'], ['b', 'e'],
  ].map(([startVertexId, endVertexId], index) => ({
    id: `w${index}`, startVertexId: startVertexId!, endVertexId: endVertexId!,
    thicknessMm: 150, dimensionalOrigin: 'physical' as const,
  }));
  const upper = addBuildingLevel(doc), lower = switchBuildingLevel(upper, upper.levels![0]!.id);
  expect(idsByKind(upper, deriveRooms(upper), 'floors')).toEqual([]);
  const ids = idsByKind(lower, deriveRooms(lower), 'floors');
  expect(ids).toHaveLength(2);
  const store = createEditorStore(lower);
  applyKindSelection(store, 'floors', ids);
  expect(store.getState().selection).toEqual(ids);
  expect(store.getState().detailPanel).toBe('paint');
  const edited = setFloorFinish(lower, ids[0]!, { color: '#668877', undersideColor: '#334455' });
  const result = propagateToPeers(lower, edited, ids[0]!, bulkPeers(lower, ids[0]!, ids));
  expect(ids.map((id) => [floorFinish(result, id).color, floorFinish(result, id).undersideColor]))
    .toEqual([['#668877', '#334455'], ['#668877', '#334455']]);
});

it('la composición de un cerramiento se copia a los demás sin arrastrar sus puertas', () => {
  let doc = addLinearBoundary(emptyEditorDocument(), 'valla-madera', { x: 0, y: 0 }, { x: 6000, y: 0 });
  doc = addLinearBoundary(doc, 'valla-madera', { x: 0, y: 3000 }, { x: 6000, y: 3000 });
  const [a, b] = doc.boundaries!.map((x) => x.id) as [string, string];
  doc = addBoundaryGate(doc, b, 3000);
  const edited = updateBoundary(doc, a, { heightMm: 1800, construction: { ...doc.boundaries![0]!.construction, baseHeightMm: 600 } });
  const next = propagateToPeers(doc, edited, a, bulkPeers(doc, a, [a, b]));
  const peer = next.boundaries!.find((x) => x.id === b)!;
  expect(peer.heightMm).toBe(1800);
  expect(peer.construction.baseHeightMm).toBe(600);
  expect(peer.construction.gates).toHaveLength(1);
});
