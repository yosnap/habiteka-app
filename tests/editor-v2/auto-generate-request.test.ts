import { describe, expect, it } from 'vitest';
import { autoGenerateInteriorRoomIds, interiorsEditorHref, parseAutoGenerate } from '@/components/editor-v2/auto-generate-request';
import { roomInteriorCameras } from '@/lib/editor-document/room-interior-cameras';
import { twoRoomDocument } from '../fixtures/two-room-document';

describe('entrada a interiores desde primera persona', () => {
  it('conserva zona, luz y una sola toma al abrir el editor, sin modificar la entrada general', () => {
    const url = new URL(interiorsEditorHref('project', 'zone', undefined, { lighting: 'warm', singleInterior: true }), 'https://example.com');
    expect(url.pathname).toBe('/projects/project');
    expect(url.searchParams.get('zona')).toBe('zone');
    expect(parseAutoGenerate(Object.fromEntries(url.searchParams))).toEqual({ interiorRooms: true, lighting: 'warm', singleInterior: true });
    expect(interiorsEditorHref('project', null)).toBe('/projects/project?generar=interiores');
    expect(parseAutoGenerate({ generar: 'interiores' })).toEqual({ interiorRooms: true });
  });
  it('ignora parámetros desconocidos y no abre generación cuando no se pide', () => {
    expect(parseAutoGenerate({ generar: 'otro', luz: 'warm', toma: 'una' })).toBeNull();
    expect(parseAutoGenerate({ generar: 'interiores', luz: 'invalid', toma: 'all' })).toEqual({ interiorRooms: true });
  });
  it('propone salón para el piloto y mantiene todas las habitables para el asistente general', () => {
    const cameras = roomInteriorCameras(twoRoomDocument());
    const named = cameras.map((camera, index) => ({ ...camera, name: index === 1 ? 'Salón / Cocina' : 'Dormitorio' }));
    expect(autoGenerateInteriorRoomIds(named, true)).toEqual([named[1]!.roomId]);
    expect(autoGenerateInteriorRoomIds(named)).toEqual(named.map(camera => camera.roomId));
    expect(autoGenerateInteriorRoomIds(cameras, true)).toEqual([cameras[0]!.roomId]);
    expect(autoGenerateInteriorRoomIds(cameras.map(camera => ({ ...camera, habitable: false })), true)).toEqual([]);
  });
});
