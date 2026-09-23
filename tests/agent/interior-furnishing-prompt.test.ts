/**
 * Vistas interiores por estancia: el prompt debe nombrar la estancia de la cámara
 * y ordenar amueblarla. Sin esa orden, el modo libre entregaba habitaciones vacías.
 */
import { describe, expect, it } from 'vitest';
import {
  interiorFurnishingRule,
  interiorRoomForView,
} from '@/server/agent/editor-v2/selected-view-prompt';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { roomInteriorCameras } from '@/lib/editor-document/room-interior-cameras';
import { renderDesignOptionsSchema } from '@/lib/editor-document/render-design-options';
import type { RenderView } from '@/lib/editor-document/render-view';
import raw from '../editor-document/fixtures/plano-vivienda-real.json';

const document = parseEditorDocument(raw);
const cameras = roomInteriorCameras(document);
const viewAt = (position: [number, number, number]): RenderView => ({
  preset: 'custom', position, quaternion: [0, 0, 0, 1], fov: 70, aspect: 1.5, allLevels: false, cutaway: false,
});
const options = (freedom: 'strict' | 'controlled' | 'free') =>
  renderDesignOptionsSchema.parse({ freedom, interiorRoomIds: cameras.map((c) => c.roomId) });

describe('amueblado de vistas interiores', () => {
  it('reconoce la estancia de cada cámara interior', () => {
    for (const camera of cameras) {
      expect(interiorRoomForView(document, viewAt(camera.camera.position as [number, number, number]))).toBe(camera.name);
    }
    expect(interiorRoomForView(document, viewAt([-50, 1.6, -50]))).toBeNull();
  });

  it('en modo libre ordena amueblar la estancia nombrada y prohíbe entregarla vacía', () => {
    const rule = interiorFurnishingRule('Dormitorio', 'moderno', options('free'));
    expect(rule).toContain('«Dormitorio»');
    expect(rule).toContain('No la entregues vacía');
    expect(rule).toContain('Moderno');
  });

  it('en modo estricto no añade nada', () => {
    expect(interiorFurnishingRule('Dormitorio', 'moderno', options('strict'))).toBeNull();
  });

  it('fuera del modo interior no aplica', () => {
    expect(interiorFurnishingRule('Dormitorio', 'moderno', renderDesignOptionsSchema.parse({ freedom: 'free' }))).toBeNull();
  });
});
