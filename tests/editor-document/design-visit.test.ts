import { describe, expect, it } from 'vitest';
import { designVisitContext, designVisitSelectionIssue, designVisitPrompt, defaultDesignVisitReferenceIds } from '@/lib/editor-document/design-visit';
import type { DesignVideoReference } from '@/lib/editor-document/design-video';
import { DEFAULT_VIDEO_PRESENTATION } from '@/lib/editor-document/video-presentation';
import { roomInteriorCameras } from '@/lib/editor-document/room-interior-cameras';
import type { RenderView } from '@/lib/editor-document/render-view';
import { twoRoomDocument } from '../fixtures/two-room-document';

const doc = twoRoomDocument();
function interiorView(): RenderView {
  const camera = roomInteriorCameras(doc)[0]!.camera;
  return { preset: 'custom', position: camera.position, focus: camera.focus, fov: camera.fovDeg, levelId: camera.levelId,
    quaternion: [0, 0, 0, 1], aspect: 16 / 9, allLevels: false, cutaway: false, ceilingView: 'solid' };
}
const reference = (id: string, extra: Partial<DesignVideoReference> = {}): DesignVideoReference => ({ id, name: 'Salón', view: 'Interior',
  preset: 'custom', batchId: 'batch', revision: 7, zones: ['Salón'], scope: 'rooms', closedRoof: true,
  url: 'https://storage.example/interior.png', interiorRoomId: 'ground:room', interiorRoomName: 'Salón', ...extra });
describe('toma en primera persona desde diseños', () => {
  it('verifica estancia y cámara reales sin fiarse de roomId ni roomName guardados', () => {
    const context = designVisitContext(doc, { ...interiorView(), roomId: 'inventado', roomName: 'Inventado' });
    expect(context.interiorRoomId).toBe(`ground:${roomInteriorCameras(doc)[0]!.roomId}`);
    expect(context.interiorRoomName).not.toBe('Inventado');
    expect(context.visitIssue).toBeUndefined();
  });
  it.each([{ preset: 'top' as const }, { allLevels: true }, { cutaway: true }, { ceilingView: 'hidden' as const },
    { ceilingView: 'transparent' as const }, { cutawayWallIds: ['wall'] }, { cutawayObjectIds: ['curtain'] },
    { position: [100, 100, 100] as [number, number, number] }])('rechaza una cámara incompatible %j', override => {
    expect(designVisitContext(doc, { ...interiorView(), ...override }).visitIssue).toBeTruthy();
  });
  it('no propone vistas aéreas ni rechazadas y no rellena la selección con otras habitaciones', () => {
    expect(defaultDesignVisitReferenceIds([reference('top', { visitIssue: 'Vista aérea' }), reference('rejected', { issue: 'TV inventada' }),
      reference('interior'), reference('other', { interiorRoomId: 'other' })])).toEqual(['interior']);
    expect(defaultDesignVisitReferenceIds([reference('old', { batchId: null })])).toEqual([]);
  });
  it('bloquea antes de generar habitaciones mezcladas, tandas distintas y fotos no verificadas', () => {
    expect(designVisitSelectionIssue([reference('a')])).toBeNull();
    expect(designVisitSelectionIssue([reference('a'), reference('b', { interiorRoomId: 'other' })])).toContain('una toma por estancia');
    expect(designVisitSelectionIssue([reference('a'), reference('b', { batchId: 'other' })])).toContain('misma tanda');
    expect(designVisitSelectionIssue([reference('a', { issue: 'Sofá cambiado' })])).toContain('Sofá cambiado');
    expect(designVisitSelectionIssue([reference('a', { interiorRoomId: undefined })])).toContain('Falta la estancia');
    expect(designVisitSelectionIssue([])).toContain('1 a 9');
  });
  it('pide conservar muebles del diseño, no construir ni salir de la estancia y guarda indicaciones', () => {
    const prompt = designVisitPrompt('evening', { resolution: '768P', presentation: { ...DEFAULT_VIDEO_PRESENTATION, prompt: 'acercarse al sofá' } }, [reference('a')]);
    for (const text of ['8 segundos', 'Salón', 'no mostrar construcción', 'referencia 1', 'TV', 'cortinas', 'sin cortes',
      'no inventar accesos', 'No mover ni transformar muebles', 'evening', 'acercarse al sofá']) expect(prompt).toContain(text);
    expect(prompt).not.toContain('muros consecutivos');
  });
});
