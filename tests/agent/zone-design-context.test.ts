import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { zoneDesignContext } from '@/server/agent/editor-v2/zone-design-context';

describe('contexto del diseño por zona', () => {
  it('omite muebles y zonas ajenos, pero conserva la paleta del proyecto', () => {
    const doc = emptyEditorDocument();
    const polygon = [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 3000 }, { x: 0, y: 3000 }];
    doc.designZones = [{ id: 'salon', name: 'Salón', polygon },
      { id: 'patio', name: 'Patio', polygon: polygon.map((point) => ({ x: point.x + 9000, y: point.y })) }];
    doc.furniture.push(
      { id: 'sofa', kind: 'sofa', x: 500, y: 500, widthMm: 800, depthMm: 800, rotation: 0, dimensionalOrigin: 'physical' },
      { id: 'coche', kind: 'coche', x: 9500, y: 500, widthMm: 800, depthMm: 800, rotation: 0, dimensionalOrigin: 'physical' },
    );
    const context = zoneDesignContext(doc, doc.designZones[0]!, []);
    expect(context.levels).toHaveLength(1);
    expect(context.levels[0]?.furniture.map((item) => item.id)).toEqual(['sofa']);
    expect(context.levels[0]?.designZones.map((item) => item.id)).toEqual(['salon']);
    expect(context.existingMaterialPalette).toBeDefined();
  });

  it('no envía muros de la parte excluida de una zona en L aunque caigan en su rectángulo envolvente', () => {
    const doc = emptyEditorDocument();
    const zone = { id: 'salon', name: 'Salón', polygon: [
      { x: 3000, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 },
      { x: 0, y: 5000 }, { x: 0, y: 4000 }, { x: 3000, y: 4000 },
    ] };
    doc.designZones = [zone];
    doc.vertices.push(
      { id: 'a', x: 1000, y: 1500 }, { id: 'b', x: 1000, y: 3500 },
      { id: 'c', x: 4000, y: 1500 }, { id: 'd', x: 4000, y: 3500 },
    );
    doc.walls.push(
      { id: 'dormitorio', startVertexId: 'a', endVertexId: 'b', thicknessMm: 100, dimensionalOrigin: 'physical' },
      { id: 'salon', startVertexId: 'c', endVertexId: 'd', thicknessMm: 100, dimensionalOrigin: 'physical' },
    );
    const context = zoneDesignContext(doc, zone, []);
    expect(context.levels[0]?.walls.map((wall) => wall.id)).toEqual(['salon']);
  });
});
