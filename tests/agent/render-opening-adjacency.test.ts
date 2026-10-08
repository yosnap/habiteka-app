import { describe, expect, it } from 'vitest';
import { twoRoomDocument } from '../fixtures/two-room-document';
import { spatialOpenings } from '@/server/agent/editor-v2/spatial-opening-geometry';
import { renderSpatialContext } from '@/server/agent/editor-v2/render-spatial-context';
import { deriveRoomsSafe } from '@/lib/editor-document/rooms';
import { pointInPolygon } from '@/lib/editor-document/polygon-tools';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import type { RenderView } from '@/lib/editor-document/render-view';

describe('estancias al otro lado del hueco y vidrio de cubierta', () => {
  it('incluye el recinto sin etiqueta para no trasladar otra habitación a su hueco', () => {
    const doc = twoRoomDocument();
    doc.labels = [{ id: 'patio', text: 'Patio', x: 1500, y: 2000 }];
    doc.openings = [{ id: 'window', wallId: 'w6', kind: 'ventana', position: .5, widthMm: 1000, dimensionalOrigin: 'physical' }];
    const connections = spatialOpenings(doc, 'L1')[0]!.connectsRooms!;
    expect(connections.map(room => room.name).sort()).toEqual(['Patio', 'Recinto sin etiqueta']);
    expect(connections.find(room => room.name === 'Recinto sin etiqueta')!.boundary!.length).toBeGreaterThan(2);
  });
  it('vincula patio y estudio a su ventana aunque solo se revise el patio', () => {
    const doc = twoRoomDocument();
    doc.labels = [{ id: 'patio', text: 'Patio', x: 1500, y: 2000 }, { id: 'study', text: 'Estudio', x: 4500, y: 2000 }];
    doc.openings = [{ id: 'window', wallId: 'w6', kind: 'ventana', position: .5, widthMm: 1000, dimensionalOrigin: 'physical' }];
    const patio = deriveRoomsSafe(doc).find(room => pointInPolygon(doc.labels[0]!, room.boundary))!;
    const context = renderSpatialContext(doc, { preset: 'custom', roomId: patio.id } as RenderView, defaultRenderDesignOptions());
    expect(context.levels[0]!.rooms.map(room => room.name)).toEqual(['Patio']);
    expect(context.levels[0]!.openings[0]!.connectsRooms?.map(room => room.name).sort()).toEqual(['Estudio', 'Patio']);
    doc.walls[6]!.hidden = true;
    expect(spatialOpenings(doc, 'L1')).toEqual([]);
  });
  it('conserva la posición del cristal sin confundirlo con una chimenea ni editar el plano', () => {
    const doc = twoRoomDocument();
    doc.exteriorRoof = { kind: 'hip', roomIds: [], color: '#444444', pitchDeg: 15, eavesMm: 300,
      thicknessMm: 100, orientationDeg: 0, openings: [
        { id: 'glass', kind: 'glass', x: 1000, y: 1500, widthMm: 1200, depthMm: 1500, rotation: 0 },
        { id: 'chimney', kind: 'chimney', x: 4000, y: 500, widthMm: 500, depthMm: 500, rotation: 0 },
      ] };
    const before = structuredClone(doc);
    const context = renderSpatialContext(doc, { preset: 'custom' } as RenderView, defaultRenderDesignOptions());
    expect(context.roofGlazing).toHaveLength(1);
    expect(context.roofGlazing![0]!.footprint).toContainEqual({ x: 1000, y: 1500 });
    expect(doc).toEqual(before);
  });
});
