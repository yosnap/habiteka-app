import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type EditorDocument, type Point } from '@/lib/editor-document/schema';
import { boundaryClearance, insideRoom } from '@/lib/editor-document/ceiling-geometry';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { setFloorFinish } from '@/lib/editor-document/floor-finishes';
import {
  EYE_HEIGHT_MM,
  INTERIOR_FOV_DEG,
  INTERIOR_FOV_MAX_DEG,
  interiorFovDeg,
  roomInteriorCameras,
  selectedInteriorCameras,
} from '@/lib/editor-document/room-interior-cameras';

/** Construye un documento con un único contorno cerrado por los puntos dados. */
function polygonDoc(points: Point[], thicknessMm = 150): EditorDocument {
  const doc = emptyEditorDocument();
  doc.vertices = points.map((point, index) => ({ id: `v${index}`, ...point }));
  doc.walls = points.map((_, index) => ({
    id: `w${index}`,
    startVertexId: `v${index}`,
    endVertexId: `v${(index + 1) % points.length}`,
    thicknessMm,
    dimensionalOrigin: 'physical' as const,
  }));
  return doc;
}

/** El mismo contorno con una etiqueta del plano dentro: el nombre de la estancia. */
function named(points: Point[], text: string): EditorDocument {
  const doc = polygonDoc(points);
  const centre = {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };
  doc.labels = [{ id: 'z0', text, ...centre }];
  return doc;
}

const rectangle = () =>
  polygonDoc([
    { x: 0, y: 0 },
    { x: 5000, y: 0 },
    { x: 5000, y: 4000 },
    { x: 0, y: 4000 },
  ]);

/** Planta en L: su centroide cae fuera del polígono. */
const lShaped = () =>
  polygonDoc([
    { x: 0, y: 0 },
    { x: 6000, y: 0 },
    { x: 6000, y: 2000 },
    { x: 2000, y: 2000 },
    { x: 2000, y: 6000 },
    { x: 0, y: 6000 },
  ]);

describe('cámaras interiores por estancia', () => {
  it('coloca el ojo dentro de la estancia, a 1,6 m, mirando al interior', () => {
    const doc = rectangle();
    const [camera] = roomInteriorCameras(doc);
    expect(camera).toBeDefined();
    const [x, y, z] = camera!.camera.position;
    expect(y).toBeCloseTo(EYE_HEIGHT_MM / 1000, 6);
    expect(insideRoom({ x: x * 1000, y: z * 1000 }, deriveRooms(doc)[0]!.boundary)).toBe(true);
    // La mirada apunta al centro de la planta, no a un punto cualquiera.
    expect(camera!.camera.focus[0]).toBeCloseTo(2.5, 3);
    expect(camera!.camera.focus[2]).toBeCloseTo(2, 3);
    expect(camera!.camera.fovDeg).toBeGreaterThanOrEqual(60);
    expect(camera!.camera.fovDeg).toBeLessThanOrEqual(70);
    expect(camera!.habitable).toBe(true);
    expect(camera!.areaM2).toBeCloseTo(20, 3);
  });

  it('no deja la cámara fuera del polígono en una estancia en L', () => {
    const doc = lShaped();
    const boundary = deriveRooms(doc)[0]!.boundary;
    const [camera] = roomInteriorCameras(doc);
    const [x, , z] = camera!.camera.position;
    expect(insideRoom({ x: x * 1000, y: z * 1000 }, boundary)).toBe(true);
    const focus = camera!.camera.focus;
    expect(insideRoom({ x: focus[0] * 1000, y: focus[2] * 1000 }, boundary)).toBe(true);
  });

  it('mira desde el fondo hacia la puerta principal', () => {
    const doc = rectangle();
    // Puerta en el muro sur (y = 0), hacia su inicio: la cámara debe ir al norte.
    doc.openings = [
      {
        id: 'o1',
        wallId: 'w0',
        kind: 'puerta',
        position: 0.2,
        widthMm: 900,
        dimensionalOrigin: 'physical',
      },
    ];
    const [camera] = roomInteriorCameras(doc);
    expect(camera!.camera.position[2]).toBeGreaterThan(2);
  });

  it('marca como no habitable un hueco diminuto pero le da cámara igual', () => {
    const doc = polygonDoc([
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 },
    ]);
    const [camera] = roomInteriorCameras(doc);
    expect(camera!.habitable).toBe(false);
    expect(camera!.areaM2).toBeCloseTo(1, 3);
    const [x, , z] = camera!.camera.position;
    expect(insideRoom({ x: x * 1000, y: z * 1000 }, deriveRooms(doc)[0]!.boundary)).toBe(true);
  });

  it('sube el ojo con la cota del suelo acabado de la estancia', () => {
    const base = rectangle();
    const roomId = deriveRooms(base)[0]!.id;
    const doc = setFloorFinish(base, roomId, { elevationMm: 3000 });
    const [camera] = roomInteriorCameras(doc);
    expect(camera!.camera.position[1]).toBeCloseTo((3000 + EYE_HEIGHT_MM) / 1000, 6);
    expect(camera!.camera.focus[1]).toBeGreaterThan(3);
  });

  it('usa la etiqueta del plano como nombre y respeta la selección', () => {
    const doc = rectangle();
    doc.labels = [{ id: 'l1', x: 2500, y: 2000, text: 'Salón' }];
    const cameras = roomInteriorCameras(doc);
    expect(cameras[0]!.name).toBe('Salón');
    expect(selectedInteriorCameras(cameras, [cameras[0]!.roomId])).toHaveLength(1);
    expect(selectedInteriorCameras(cameras, ['room:inexistente'])).toHaveLength(0);
  });

  it('devuelve una cámara por estancia con plantas de varios niveles', () => {
    const doc = rectangle();
    doc.vertices.push(
      { id: 'v4', x: 7000, y: 0 },
      { id: 'v5', x: 12000, y: 0 },
      { id: 'v6', x: 12000, y: 4000 },
      { id: 'v7', x: 7000, y: 4000 },
    );
    doc.walls.push(
      ...['v4:v5', 'v5:v6', 'v6:v7', 'v7:v4'].map((pair, index) => {
        const [start, end] = pair.split(':');
        return {
          id: `wb${index}`,
          startVertexId: start!,
          endVertexId: end!,
          thicknessMm: 150,
          dimensionalOrigin: 'physical' as const,
        };
      }),
    );
    const cameras = roomInteriorCameras(doc);
    expect(cameras).toHaveLength(2);
    expect(new Set(cameras.map((camera) => camera.roomId)).size).toBe(2);
  });

  it('se aparta de la puerta y de los muros al elegir el punto de vista', () => {
    const doc = rectangle();
    doc.openings = [
      {
        id: 'o1',
        wallId: 'w0',
        kind: 'puerta',
        position: 0.5,
        widthMm: 900,
        dimensionalOrigin: 'physical',
      },
    ];
    const boundary = deriveRooms(doc)[0]!.boundary;
    const [camera] = roomInteriorCameras(doc);
    const eye = { x: camera!.camera.position[0] * 1000, y: camera!.camera.position[2] * 1000 };
    // Centro del vano: la puerta está a la mitad del muro sur.
    expect(Math.hypot(eye.x - 2500, eye.y - 0)).toBeGreaterThanOrEqual(1000);
    expect(boundaryClearance(eye, boundary)).toBeGreaterThanOrEqual(450);
  });

  it('abre el ángulo en las estancias pequeñas y lo cierra en las grandes', () => {
    expect(interiorFovDeg(2)).toBe(INTERIOR_FOV_MAX_DEG);
    expect(interiorFovDeg(6)).toBe(INTERIOR_FOV_MAX_DEG);
    expect(interiorFovDeg(20)).toBe(INTERIOR_FOV_DEG);
    expect(interiorFovDeg(42)).toBe(INTERIOR_FOV_DEG);
    expect(interiorFovDeg(11)).toBeGreaterThan(INTERIOR_FOV_DEG);
    expect(interiorFovDeg(11)).toBeLessThan(INTERIOR_FOV_MAX_DEG);
  });

  it('no marca por defecto una estancia pequeña SIN nombre', () => {
    const doc = polygonDoc([
      { x: 0, y: 0 },
      { x: 1800, y: 0 },
      { x: 1800, y: 1800 },
      { x: 0, y: 1800 },
    ]);
    const [camera] = roomInteriorCameras(doc);
    expect(camera!.areaM2).toBeLessThan(4);
    expect(camera!.habitable).toBe(false);
  });

  it('marca un baño pequeño: manda el uso, no la superficie', () => {
    const doc = named(
      [
        { x: 0, y: 0 },
        { x: 1800, y: 0 },
        { x: 1800, y: 2100 },
        { x: 0, y: 2100 },
      ],
      'Baño',
    );
    const [camera] = roomInteriorCameras(doc);
    expect(camera!.areaM2).toBeLessThan(4);
    expect(camera!.name).toBe('Baño');
    expect(camera!.habitable).toBe(true);
  });

  it('no marca pasos ni huecos aunque sean grandes, sin mirar acentos', () => {
    for (const label of ['Pasillo', 'VESTÍBULO', 'Distribuidor', 'armario ropero']) {
      const doc = named(
        [
          { x: 0, y: 0 },
          { x: 5000, y: 0 },
          { x: 5000, y: 4000 },
          { x: 0, y: 4000 },
        ],
        label,
      );
      const [camera] = roomInteriorCameras(doc);
      expect(camera!.areaM2).toBeGreaterThan(4);
      expect(camera!.habitable, label).toBe(false);
    }
  });

  it('descarta el hueco técnico de menos de 1,5 m² aunque tenga nombre', () => {
    const doc = named(
      [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 1000 },
        { x: 0, y: 1000 },
      ],
      'Aseo',
    );
    expect(roomInteriorCameras(doc)[0]!.habitable).toBe(false);
  });

  it('no rompe con un plano sin estancias cerradas', () => {
    expect(roomInteriorCameras(emptyEditorDocument())).toEqual([]);
  });
});
