import { describe, expect, it } from 'vitest';
import { BUILTIN_TEMPLATES } from '@/canvas/templates';
import { serializeCanvas } from '@/canvas/serialize';
import { fromCanvasV1 } from '@/lib/editor-document/adapters/canvas-v1';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { parseEditorDocument } from '@/lib/editor-document/validation';

describe('activación de plantillas legacy en el editor métrico', () => {
  it.each(BUILTIN_TEMPLATES)('$label conserva habitación cerrada, altura y muebles', (template) => {
    const raw = serializeCanvas(template.doc);
    const before = structuredClone(raw);
    const result = fromCanvasV1(raw);
    expect(result.issues).toEqual([]);
    expect(result.complete).toBe(true);
    expect(raw).toEqual(before);
    expect(result.snapshot).toEqual(before);
    const doc = result.document!;
    expect(doc.walls).toHaveLength(4);
    expect(doc.vertices).toHaveLength(4);
    expect(doc.walls.every((wall) => wall.heightMm === template.ceilingM * 1000 && wall.thicknessMm === 150)).toBe(true);
    const rooms = deriveRooms(doc);
    expect(rooms).toHaveLength(1);
    const { widthM, lengthM } = template.shapeParams;
    // El contorno se mide por el eje; las caras interiores conservan las medidas de la plantilla.
    expect(rooms[0]!.areaMm2).toBeCloseTo((widthM * 1000 + 150) * (lengthM * 1000 + 150));
    for (const furniture of template.doc.objects.filter((obj) => obj.kind !== 'wall')) {
      expect(doc.furniture.find((item) => item.id === furniture.id)).toMatchObject({
        x: furniture.x * 10, y: furniture.y * 10, widthMm: furniture.width * 10,
        depthMm: furniture.height * 10, rotation: furniture.rotation,
      });
    }
    expect(parseEditorDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });

  it('metadatos desconocidos siguen bloqueando sin perder el snapshot', () => {
    const raw = structuredClone(BUILTIN_TEMPLATES[0]!.doc);
    raw.objects[0]!.meta!.futureGeometry = 20;
    const result = fromCanvasV1(raw);
    expect(result.complete).toBe(false);
    expect(result.issues).toContain('Campo no convertible: futureGeometry');
    expect(result.snapshot).toEqual(raw);
  });

  it.each([0, -1, NaN, Infinity])('rechaza altura inválida %s', (ceilingHeightM) => {
    const result = fromCanvasV1({ ...BUILTIN_TEMPLATES[0]!.doc, ceilingHeightM });
    expect(result.complete).toBe(false);
    expect(result.document).toBeNull();
  });
});
