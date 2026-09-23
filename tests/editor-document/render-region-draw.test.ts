/**
 * Lógica de las zonas permitidas del render: cerrar un polígono punto a punto,
 * rechazar contornos con lazos, acotar los vértices al máximo del esquema y
 * acertar sobre qué estancia se ha pulsado.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_POLYGON_POINTS,
  limitPolygonVertices,
  pointInPolygon,
  polygonSelfIntersects,
  simplifyPolygon,
} from '@/lib/editor-document/polygon-tools';
import {
  closeDraftPolygon,
  closesOnFirstVertex,
  planRegionRooms,
  rectanglePolygon,
  roomAtPoint,
  uniqueRegionName,
} from '@/lib/editor-document/render-region-draw';
import { renderDesignOptionsSchema } from '@/lib/editor-document/render-design-options';
import { roomInteriorCameras } from '@/lib/editor-document/room-interior-cameras';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import raw from './fixtures/plano-vivienda-real.json';

const square = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];
/** Mismo cuadrado con puntos de muestreo intermedios, como los contornos derivados. */
const sampledSquare = [
  ...Array.from({ length: 12 }, (_, i) => ({ x: (i * 4000) / 12, y: 0 })),
  ...Array.from({ length: 12 }, (_, i) => ({ x: 4000, y: (i * 3000) / 12 })),
  ...Array.from({ length: 12 }, (_, i) => ({ x: 4000 - (i * 4000) / 12, y: 3000 })),
  ...Array.from({ length: 12 }, (_, i) => ({ x: 0, y: 3000 - (i * 3000) / 12 })),
];

describe('polígonos de zonas permitidas', () => {
  it('simplifica un contorno muestreado sin perder sus esquinas', () => {
    const simplified = simplifyPolygon(sampledSquare, 1);
    expect(simplified).toHaveLength(4);
    for (const corner of square)
      expect(simplified.some((point) => point.x === corner.x && point.y === corner.y)).toBe(true);
  });

  it('acota cualquier contorno al máximo de vértices del esquema', () => {
    const circle = Array.from({ length: 64 }, (_, i) => ({
      x: 3000 + 2000 * Math.cos((i / 64) * 2 * Math.PI),
      y: 3000 + 2000 * Math.sin((i / 64) * 2 * Math.PI),
    }));
    const limited = limitPolygonVertices(circle, MAX_POLYGON_POINTS);
    expect(limited.length).toBeLessThanOrEqual(MAX_POLYGON_POINTS);
    expect(limited.length).toBeGreaterThanOrEqual(3);
    // Sigue siendo el mismo círculo: el centro queda dentro y el radio se conserva.
    expect(pointInPolygon({ x: 3000, y: 3000 }, limited)).toBe(true);
    for (const point of limited)
      expect(Math.hypot(point.x - 3000, point.y - 3000)).toBeCloseTo(2000, 0);
  });

  it('detecta un contorno que se cruza consigo mismo', () => {
    expect(polygonSelfIntersects(square)).toBe(false);
    expect(
      polygonSelfIntersects([
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 0, y: 3000 },
        { x: 4000, y: 3000 },
      ]),
    ).toBe(true);
  });

  it('cierra el trazo solo con tres vértices y sin lazos', () => {
    expect(closeDraftPolygon(square.slice(0, 2))).toEqual({ ok: false, reason: 'pocos-vertices' });
    expect(
      closeDraftPolygon([
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 0, y: 3000 },
        { x: 4000, y: 3000 },
      ]),
    ).toEqual({ ok: false, reason: 'autointerseccion' });
    const closed = closeDraftPolygon(sampledSquare);
    expect(closed.ok).toBe(true);
    expect(closed.ok && closed.polygon.length).toBeLessThanOrEqual(MAX_POLYGON_POINTS);
  });

  it('solo cierra sobre el primer vértice con el trazo ya válido', () => {
    expect(closesOnFirstVertex(square.slice(0, 2), { x: 0, y: 0 }, 400)).toBe(false);
    expect(closesOnFirstVertex(square, { x: 900, y: 900 }, 400)).toBe(false);
    expect(closesOnFirstVertex(square, { x: 100, y: 100 }, 400)).toBe(true);
  });

  it('ignora el arrastre que en realidad fue un clic', () => {
    expect(rectanglePolygon({ x: 0, y: 0 }, { x: 100, y: 2000 }, 300)).toBeNull();
    expect(rectanglePolygon({ x: 4000, y: 3000 }, { x: 0, y: 0 }, 300)).toEqual(square);
  });

  it('no repite el nombre de una zona ya marcada', () => {
    expect(uniqueRegionName(' ', [])).toBe('Zona permitida');
    expect(uniqueRegionName('Salón', ['Salón'])).toBe('Salón 2');
    expect(uniqueRegionName('Salón', ['Salón', 'Salón 2'])).toBe('Salón 3');
  });
});

describe('zonas por estancia sobre un plano real', () => {
  const document = parseEditorDocument(raw);
  const rooms = planRegionRooms(document);

  it('ofrece cada estancia con su etiqueta y un contorno válido para el esquema', () => {
    expect(rooms.length).toBeGreaterThanOrEqual(6);
    expect(rooms.some((room) => room.name === 'Salón - Cocina')).toBe(true);
    for (const room of rooms) {
      expect(room.polygon.length).toBeGreaterThanOrEqual(3);
      expect(room.polygon.length).toBeLessThanOrEqual(MAX_POLYGON_POINTS);
    }
    const parsed = renderDesignOptionsSchema.parse({
      freedom: 'free',
      placement: 'selected',
      regions: rooms.slice(0, 12).map((room, index) => ({
        id: `r${index}`,
        name: room.name,
        polygon: room.polygon,
      })),
    });
    expect(parsed.regions).toHaveLength(Math.min(12, rooms.length));
  });

  it('devuelve la estancia bajo el punto y nada fuera del plano', () => {
    const target = rooms.find((room) => room.name === 'Salón - Cocina')!;
    // La cámara interior de la estancia está dentro por construcción (en metros).
    const camera = roomInteriorCameras(document).find((item) => item.roomId === target.roomId)!;
    const inside = { x: camera.camera.position[0] * 1000, y: camera.camera.position[2] * 1000 };
    expect(roomAtPoint(rooms, inside)?.name).toBe('Salón - Cocina');
    expect(roomAtPoint(rooms, { x: -50_000, y: -50_000 })).toBeNull();
  });
});
