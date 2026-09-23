/**
 * Regresión con el plano real de una vivienda (importado por un usuario): las
 * cámaras interiores deben caer dentro de su estancia EN COORDENADAS DE ESCENA,
 * que es donde se aplica la pose al capturar el 3D, y no pegadas a un muro ni
 * dentro de una puerta.
 */
import { describe, expect, it } from 'vitest';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { insideRoom } from '@/lib/editor-document/ceiling-geometry';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { deriveRooms } from '@/lib/editor-document/rooms';
import {
  interiorFovDeg,
  roomInteriorCameras,
} from '@/lib/editor-document/room-interior-cameras';
import raw from './fixtures/plano-vivienda-real.json';

// El recorte conserva el plano tal cual se guardó (muros, huecos, etiquetas) y
// vacía lo que no influye en el encuadre; se valida como lo hace el servidor.
const document = parseEditorDocument(raw);

describe('cámaras interiores sobre un plano real', () => {
  it('deja cada ojo dentro del suelo de su estancia en coordenadas de escena', () => {
    const scene = editorDocumentToScene(document);
    const cameras = roomInteriorCameras(document);
    expect(cameras.length).toBeGreaterThanOrEqual(6);
    for (const camera of cameras) {
      const floor = scene.polygons.find(
        (polygon) => polygon.role === 'floor' && polygon.sourceEntityId === camera.roomId,
      );
      expect(floor, `sin suelo para ${camera.name}`).toBeDefined();
      const [x, y, z] = camera.camera.position;
      // El suelo de la escena ya está en metros y con el eje Y del plano en Z.
      expect(
        insideRoom({ x, y: z }, floor!.points),
        `${camera.name} fuera de su estancia`,
      ).toBe(true);
      expect(y).toBeGreaterThan(1.5);
    }
  });

  it('se separa de los muros y de las puertas, y abre el ángulo en lo pequeño', () => {
    const rooms = deriveRooms(document);
    for (const camera of roomInteriorCameras(document)) {
      const room = rooms.find((item) => item.id === camera.roomId)!;
      const eye = { x: camera.camera.position[0] * 1000, y: camera.camera.position[2] * 1000 };
      const clearance = Math.min(
        ...room.boundary.map((a, index) => {
          const b = room.boundary[(index + 1) % room.boundary.length]!;
          const length2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
          const t = Math.max(
            0,
            Math.min(1, ((eye.x - a.x) * (b.x - a.x) + (eye.y - a.y) * (b.y - a.y)) / (length2 || 1)),
          );
          return Math.hypot(eye.x - a.x - (b.x - a.x) * t, eye.y - a.y - (b.y - a.y) * t);
        }),
      );
      expect(clearance, `${camera.name} empotrada en un muro`).toBeGreaterThanOrEqual(440);
      expect(camera.camera.fovDeg).toBe(interiorFovDeg(camera.areaM2));
    }
  });

  it('marca el baño pequeño y descarta los restos sin nombre', () => {
    const cameras = roomInteriorCameras(document);
    const bathroom = cameras.find((camera) => camera.name === 'Baño');
    expect(bathroom, 'el plano real tiene un baño etiquetado').toBeDefined();
    expect(bathroom!.areaM2).toBeLessThan(4);
    expect(bathroom!.habitable).toBe(true);
    // Los contornos sin etiqueta y pequeños son restos del plano, no estancias.
    const leftovers = cameras.filter((camera) => camera.name.startsWith('Estancia '));
    expect(leftovers.length).toBeGreaterThan(0);
    expect(leftovers.every((camera) => camera.areaM2 >= 4 || !camera.habitable)).toBe(true);
    expect(cameras.filter((camera) => camera.areaM2 >= 4).every((camera) => camera.habitable)).toBe(
      true,
    );
  });
});
