import { describe, expect, it } from 'vitest';
import { fromCanvasV1 } from '@/lib/editor-document/adapters/canvas-v1';
import { toCanvasV1 } from '@/lib/editor-document/adapters/to-canvas-v1';
import { fromPlano2d } from '@/lib/editor-document/adapters/plano2d';
import { furnishedCanvas, metricRectangle } from '../fixtures/editor-v2/geometry-fixtures';

describe('regresiones de revisión de compatibilidad', () => {
  it('el downgrade entrega muros al consumidor legacy que renderiza objects', () => {
    const document = fromCanvasV1(furnishedCanvas).document!;
    const legacy = toCanvasV1(document);
    expect(legacy.objects.filter((o) => o.kind === 'wall')).toHaveLength(document.walls.length);
    expect(legacy.walls).toBeUndefined();
    expect(fromCanvasV1(legacy).document?.walls).toHaveLength(document.walls.length);
  });

  it('no declara completa una conversión con campos desconocidos en puntos', () => {
    const raw = structuredClone(furnishedCanvas) as unknown as Record<string, unknown>;
    raw.objects = [];
    raw.walls = [{ id: 'wall', p1: { x: 0, y: 0, futureOffset: 10 },
      p2: { x: 400, y: 0 }, thicknessPx: 15 }];
    const result = fromCanvasV1(raw);
    expect(result.snapshot).toEqual(raw);
    expect(result.complete).toBe(false);
  });

  it('rechaza abertura perpendicular aunque su centro esté sobre el muro', () => {
    const raw = structuredClone(furnishedCanvas);
    raw.objects.push({ id: 'perpendicular', kind: 'door', parentId: 'north',
      x: 107.5, y: -37.5, width: 90, height: 15, rotation: 90 });
    const result = fromCanvasV1(raw);
    expect(result.snapshot).toEqual(raw);
    expect(result.complete).toBe(false);
  });

  it.each(['scale', 'rooms'])('no descarta semántica no representada de %s', (key) => {
    const raw = structuredClone(furnishedCanvas) as unknown as Record<string, unknown>;
    raw[key] = key === 'scale' ? { pxPerMeter: 100, futureScale: 2 } : [{ id: 'room', name: 'Cocina' }];
    expect(fromCanvasV1(raw).complete).toBe(false);
  });

  it.each(['outline', 'wall', 'dimension'])('inspecciona puntos anidados de plano: %s', (kind) => {
    const raw = structuredClone(metricRectangle);
    const zone = raw.zones[0]!;
    const point = kind === 'outline' ? zone.outline[0]! : kind === 'wall'
      ? zone.walls[0]!.from : zone.dimensions[0]!.to;
    Object.assign(point, { futureOffset: 20 });
    expect(fromPlano2d(raw).complete).toBe(false);
  });

  it('round-trip oblicuo conserva extremos y centros de huecos dentro de 1 mm', () => {
    const raw = structuredClone(furnishedCanvas);
    raw.objects = [{ id: 'wall', kind: 'wall', x: 30, y: 40, width: 500, height: 15, rotation: 37 }];
    const first = fromCanvasV1(raw).document!;
    first.openings.push({ id: 'door', wallId: 'wall', kind: 'puerta', position: 0.3,
      widthMm: 800, dimensionalOrigin: 'raster' });
    const result = fromCanvasV1(toCanvasV1(first));
    expect(result.complete).toBe(true);
    const second = result.document!;
    first.vertices.forEach((point, index) => {
      const converted = second.vertices[index]!;
      expect(Math.hypot(converted.x - point.x, converted.y - point.y)).toBeLessThan(1);
    });
    expect(Math.abs(second.openings[0]!.position - 0.3) * 5000).toBeLessThan(1);
    expect(second.openings[0]!.widthMm).toBeCloseTo(800, 8);
  });
});
