import { describe, expect, it } from 'vitest';
import { twoRoomDocument } from '../fixtures/two-room-document';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { propertyVisitRoomContext } from '@/lib/editor-document/property-visit-room-context';
import type { PropertyVisitFrame } from '@/lib/editor-document/property-visit-types';
import { renderSpatialContext } from '@/server/agent/editor-v2/render-spatial-context';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import type { RenderView } from '@/lib/editor-document/render-view';

function house() {
  const doc = twoRoomDocument();
  doc.labels = [{ id: 'left', text: 'Salón', x: 1500, y: 2000 }, { id: 'right', text: 'Cocina', x: 4500, y: 2000 }];
  doc.openings = [{ id: 'entry', wallId: 'w5', kind: 'puerta', position: .5, widthMm: 1200, dimensionalOrigin: 'physical' }];
  doc.furniture = [{ id: 'porch', kind: 'porche-entrada', catalogId: 'habiteka:outdoor:porche-entrada',
    x: -2000, y: 1000, widthMm: 2000, depthMm: 2000, rotation: 0, dimensionalOrigin: 'physical' }];
  const upgraded = upgradeSpatialDocument(doc); upgraded.openings[0]!.openAngleDeg = 90;
  upgraded.furniture[0]!.heightMm = 2800;
  return upgraded;
}
function frame(x: number, z: number, fx: number, fz: number): PropertyVisitFrame {
  return { id: 'frame', label: 'Entrada', levelId: 'ground', roomId: null, secondsFromPrevious: 0,
    camera: { position: [x, 1.6, z], focus: [fx, 1.6, fz], fovDeg: 75, levelId: null } };
}
describe('interiorismo de cámaras intermedias y umbrales', () => {
  it('reconoce una cámara cualquiera del paseo, sin exigir una foto predefinida', () => {
    expect(propertyVisitRoomContext(house(), frame(1.234, 1.8, 1.8, 1.8))?.roomName).toBe('Salón');
  });
  it('reconoce el interior visto desde una puerta abierta, pero no atraviesa la puerta cerrada', () => {
    const doc = house(), camera = frame(-.4, 2, .6, 2);
    expect(propertyVisitRoomContext(doc, camera)?.roomName).toBe('Salón');
    doc.openings[0]!.openAngleDeg = 0;
    expect(propertyVisitRoomContext(doc, camera)).toBeNull();
  });
  it('no atribuye la cocina situada detrás del tabique ni otra planta', () => {
    expect(propertyVisitRoomContext(house(), frame(2.5, 2, 3.5, 2))?.roomName).toBe('Salón');
    expect(propertyVisitRoomContext(house(), { ...frame(1, 2, 2, 2), levelId: 'unknown' })).toBeNull();
  });
  it('conserva contorno y nombre de una zona sin etiqueta para localizarla en el diseño', () => {
    const doc = house(); doc.labels = [];
    const context = propertyVisitRoomContext(doc, frame(1.234, 1.8, 1.8, 1.8));
    expect(context).not.toBeNull();
    const view = { preset: 'custom', allLevels: false, levelId: null, ...context } as RenderView;
    const spatial = renderSpatialContext(doc, view, defaultRenderDesignOptions());
    expect(spatial.levels[0]!.rooms).toHaveLength(1);
    expect(spatial.levels[0]!.rooms[0]!.boundary).toHaveLength(4);
    expect(spatial.levels[0]!.exterior).toEqual([]);
  });
});
