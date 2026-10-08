import { expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import type { RenderView } from '@/lib/editor-document/render-view';
import { cameraOpeningLocations, openingSightlineDepths } from '@/server/agent/editor-v2/accepted-interior-prompt';
import { twoRoomDocument } from '../fixtures/two-room-document';
import { spatialOpenings } from '@/server/agent/editor-v2/spatial-opening-geometry';

it('proyecta el uso de cada hueco al girar la cámara y distingue huecos detrás de ella', () => {
  const camera = new PerspectiveCamera(90, 1); camera.position.set(0, 1.6, 0); camera.lookAt(-1, 1.6, 0);
  const view = { fov: 90, aspect: 1, position: camera.position.toArray(), quaternion: camera.quaternion.toArray() } as RenderView;
  const locations = cameraOpeningLocations(view, { units: 'mm', levels: [{ id: 'g', name: 'Planta', rooms: [],
    openings: [{ id: 'study', kind: 'ventana', center: { x: -2000, y: -1000 }, widthMm: 1000, heightMm: 1000,
      connectsRooms: [{ name: 'Estudio', anchor: { x: -2000, y: -2000 } }] },
    { id: 'behind', kind: 'puerta', center: { x: 2000, y: 0 }, widthMm: 1000, heightMm: 2000 }] }] });
  expect(locations[0]).toMatchObject({ position: '75% desde el borde izquierdo', connects: ['Estudio'] });
  expect(locations[1]!.position).toBe('fuera del campo horizontal');
});
it('mide la pared detrás del acceso sin confundirla con su propio marco', () => {
  const doc = twoRoomDocument();
  doc.openings = [{ id: 'passage', wallId: 'w6', kind: 'hueco', position: .5, widthMm: 1000, dimensionalOrigin: 'physical' }];
  const camera = new PerspectiveCamera(75, 16 / 9); camera.position.set(1.5, 1.6, 2); camera.lookAt(5, 1.6, 2);
  const view: RenderView = { preset: 'custom', fov: 75, aspect: 16 / 9, position: camera.position.toArray(),
    quaternion: camera.quaternion.toArray(), cutaway: false, allLevels: false, ceilingView: 'solid' };
  const depths = openingSightlineDepths(doc, view, { units: 'mm', levels: [{ id: 'ground', name: 'Planta', rooms: [], openings: spatialOpenings(doc, 'L1') }] });
  expect(depths[0]!.beyondOpeningMm).toBeGreaterThan(2800);
  expect(depths[0]!.beyondOpeningMm).toBeLessThan(3100);
});
