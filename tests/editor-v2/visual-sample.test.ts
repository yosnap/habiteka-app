import { describe, expect, it } from 'vitest';
import { visualSampleDocument } from '@/app/dev/editor-v2/visual-sample';
import { ceilingIssues, ceilingSurfaces, resolvedLuminaires } from '@/lib/editor-document/ceiling-geometry';
import { roomInteriorCameras } from '@/lib/editor-document/room-interior-cameras';
import { parseEditorDocument } from '@/lib/editor-document/validation';

describe('vivienda visual de prueba', () => {
  it('mantiene un techo, una luz válida y una cámara interior en cada estancia', () => {
    const document = parseEditorDocument(visualSampleDocument());
    const surfaces = ceilingSurfaces(document);
    const roomIds = surfaces.map(({ room }) => room.id).sort();
    expect(roomIds).toHaveLength(4);
    expect(resolvedLuminaires(document).map(({ roomId }) => roomId).sort()).toEqual(roomIds);
    expect(roomInteriorCameras(document).map(({ roomId }) => roomId).sort()).toEqual(roomIds);
    expect(ceilingIssues(document)).toEqual([]);
  });

  it('encuadra el baño desde el fondo, lejos de la hoja de entrada', () => {
    const bathroom = roomInteriorCameras(visualSampleDocument()).find(({ name }) => name === 'Baño');
    expect(bathroom?.camera.position[2]).toBeGreaterThan(7);
  });

  it('encuadra la cocina sin dejar la cámara pegada al frigorífico', () => {
    const kitchen = roomInteriorCameras(visualSampleDocument()).find(({ name }) => name === 'Cocina / comedor');
    expect(kitchen?.camera.position[0]).toBeLessThan(7);
  });
});
