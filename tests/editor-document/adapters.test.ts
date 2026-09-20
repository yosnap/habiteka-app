import { describe, expect, it } from 'vitest';
import { fromCanvasV1 } from '@/lib/editor-document/adapters/canvas-v1';
import { fromPlano2d } from '@/lib/editor-document/adapters/plano2d';
import { toCanvasV1 } from '@/lib/editor-document/adapters/to-canvas-v1';
import { furnishedCanvas, metricRectangle } from '../fixtures/editor-v2/geometry-fixtures';

describe('adaptadores métricos sin normalización destructiva', () => {
  it('conserva identificadores, tres huecos y vértices compartidos', () => {
    const result = fromPlano2d(metricRectangle);
    expect(result.complete).toBe(true);
    expect(result.document?.walls.map((w) => w.id)).toEqual(['north', 'east', 'south', 'west']);
    expect(result.document?.vertices).toHaveLength(4);
    expect(result.document?.openings.map((o) => o.kind)).toEqual(['puerta', 'ventana', 'hueco']);
    expect(result.document?.openings[0]?.widthMm).toBe(900);
    expect(result.snapshot).toEqual(metricRectangle);
    expect(result.snapshot).not.toBe(metricRectangle);
  });
  it('convierte canvas calibrado sin volver a extraer una imagen', () => {
    const result = fromCanvasV1(furnishedCanvas);
    expect(result.complete).toBe(true);
    const sofa = result.document?.furniture[0];
    expect(sofa).toMatchObject({ id: 'sofa', x: 1000, y: 1000, widthMm: 2000, depthMm: 900, rotation: 30 });
    expect(result.document?.walls).toHaveLength(2);
  });
  it('round-trip calibrado mantiene medidas, identificadores y rotación', () => {
    const first = fromCanvasV1(furnishedCanvas).document!;
    const second = fromCanvasV1(toCanvasV1(first));
    expect(second.complete).toBe(true);
    expect(second.document).toEqual(first);
  });
  it('conserva snapshot y explica falta de escala, sin inventar metros', () => {
    const raw = { ...furnishedCanvas, scale: undefined };
    const result = fromCanvasV1(raw);
    expect(result.complete).toBe(false);
    expect(result.document).toBeNull();
    expect(result.issues.join(' ')).toMatch(/escala/i);
    expect(result.snapshot).toEqual(raw);
  });
  it('una versión futura se conserva pero no se convierte', () => {
    const raw = { ...metricRectangle, schemaVersion: 99, future: { important: true } };
    const result = fromPlano2d(raw);
    expect(result.complete).toBe(false);
    expect(result.document).toBeNull();
    expect(result.snapshot).toEqual(raw);
  });
  it('campos desconocidos se notifican en vez de desaparecer antes del snapshot', () => {
    const raw = { ...furnishedCanvas, importantFutureGeometry: [1, 2] };
    const result = fromCanvasV1(raw);
    expect(result.complete).toBe(false);
    expect(result.snapshot).toEqual(raw);
    expect(result.issues.join(' ')).toContain('importantFutureGeometry');
  });
});
