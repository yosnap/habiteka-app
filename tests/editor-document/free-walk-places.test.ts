import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { walkthroughNavigation } from '@/lib/editor-document/walkthrough-navigation';
import { freeWalkGuidance, freeWalkPlaces } from '@/lib/editor-document/free-walk-places';
import { addOutdoorArea } from '@/lib/editor-document/outdoor-area';

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
  doc.labels = [{ id: 'sala', x: 1500, y: 2000, text: 'Sala' },
    { id: 'dormitorio', x: 4500, y: 2000, text: 'Dormitorio' }];
  return doc;
}

describe('señales de la visita inmersiva', () => {
  it('muestra la estancia actual y el acceso real que queda delante', () => {
    const doc = twoRooms(), nav = walkthroughNavigation(doc), places = freeWalkPlaces(doc, nav);
    expect(freeWalkGuidance(places, nav, { x: 2000, y: 2000, yaw: Math.PI / 2 }))
      .toMatchObject({ current: 'Sala', destination: 'Entrada: Dormitorio', arrow: '↑' });
    expect(freeWalkGuidance(places, nav, { x: 2000, y: 2000, yaw: -Math.PI / 2 }).destination)
      .toBeUndefined();
    expect(freeWalkGuidance(places, nav, { x: 2000, y: 1000, yaw: Math.PI / 2 }).arrow).toBe('↗');
    expect(freeWalkGuidance(places, nav, { x: 2000, y: 3000, yaw: Math.PI / 2 }).arrow).toBe('↖');
    expect(freeWalkGuidance(places, nav, { x: 4000, y: 2000, yaw: -Math.PI / 2 }))
      .toMatchObject({ current: 'Dormitorio', destination: 'Entrada: Sala' });
  });

  it('identifica la salida al patio y no señala puertas cerradas', () => {
    const house = twoRooms();
    house.openings.push({ id: 'patio-door', wallId: 'w6', kind: 'puerta', position: .5,
      widthMm: 1000, dimensionalOrigin: 'physical' });
    const doc = addOutdoorArea(house, { x: 6000, y: 0 }, { x: 9000, y: 4000 }, 'Patio');
    let nav = walkthroughNavigation(doc);
    expect(freeWalkGuidance(freeWalkPlaces(doc, nav), nav, { x: 5000, y: 2000, yaw: Math.PI / 2 }).destination)
      .toBe('Salida al patio');
    doc.openings.find((opening) => opening.id === 'patio-door')!.openAngleDeg = 0;
    nav = walkthroughNavigation(doc);
    expect(freeWalkGuidance(freeWalkPlaces(doc, nav), nav, { x: 5000, y: 2000, yaw: Math.PI / 2 }).destination)
      .toBeUndefined();
  });
});
