import { describe, expect, it } from 'vitest';
import { buildEditorRenderContract } from '@/lib/editor-document/render-contract';
import { emptyEditorDocument, type EditorDocument } from '@/lib/editor-document/schema';
import { setDesignSpaceKind } from '@/lib/editor-document/spatial-properties';
import { setFloorFinish } from '@/lib/editor-document/floor-finishes';
import { addColumn, addRamp, addStair } from '@/lib/editor-document/construction-commands';

function elevatedPatio(): EditorDocument {
  const base = emptyEditorDocument();
  base.vertices = [
    { id: 'a', x: 0, y: 0 }, { id: 'b', x: 6000, y: 0 },
    { id: 'c', x: 6000, y: 4000 }, { id: 'd', x: 0, y: 4000 },
  ];
  base.walls = [
    { id: 'w1', name: 'Muro norte', startVertexId: 'a', endVertexId: 'b', thicknessMm: 150, dimensionalOrigin: 'physical' },
    { id: 'w2', startVertexId: 'b', endVertexId: 'c', thicknessMm: 150, dimensionalOrigin: 'physical' },
    { id: 'w3', startVertexId: 'c', endVertexId: 'd', thicknessMm: 150, dimensionalOrigin: 'physical' },
    { id: 'w4', startVertexId: 'd', endVertexId: 'a', thicknessMm: 150, dimensionalOrigin: 'physical' },
  ];
  const raised = setFloorFinish(setDesignSpaceKind(base, 'patio'), 'room:["w1","w2","w3","w4"]', { elevationMm: 1200 });
  const withRamp = addRamp(raised, { id: 'ramp', name: 'Acceso único', catalogId: 'builtin:ramp-straight', x: 6000, y: 1000, widthMm: 1200, depthMm: 6000, riseMm: 600, elevationMm: 0, rotation: 90, materialId: 'concrete-grey', route: { landingMm: 1200, turn: 'right', secondDepthMm: 4000, secondRiseMm: 600 } });
  const withStairs = addStair(withRamp, { id: 'stairs', name: 'Escalera lateral', kind: 'straight', catalogId: 'stair-straight', x: 0, y: 1000, widthMm: 1200, depthMm: 4000, heightMm: 1200, elevationMm: 0, rotation: 0, stepCount: 8, materialId: 'concrete-grey' });
  return addColumn(withStairs, { id: 'column', name: 'Pilar entrada', catalogId: 'builtin:column-rectangular', x: 5800, y: 0, widthMm: 400, depthMm: 400, heightMm: 2700, elevationMm: 0, rotation: 0, materialId: 'concrete-grey' });
}

describe('buildEditorRenderContract', () => {
  it('expone área, cotas y recorrido único de cada elemento estructural', () => {
    const contract = buildEditorRenderContract(elevatedPatio());
    const floor = contract.elements.find((element) => element.id === 'F-01');
    const ramp = contract.elements.find((element) => element.id === 'R-01');
    expect(floor).toMatchObject({ type: 'suelo acabado', areaM2: 24, dimensions: { finishedElevation: 1.2, undersideElevation: 0 } });
    expect(contract.totals.finishedFloorAreaM2).toBe(24);
    expect(ramp).toMatchObject({ type: 'rampa', name: 'Acceso único', dimensions: { width: 1.2, development: 10, rise: 1.2, arrivalElevation: 1.2 } });
    expect(ramp?.relationships?.join(' ')).toContain('EXISTE UNA SOLA R-01');
    expect(contract.auditPrompt).toContain('F-01 | suelo acabado');
    expect(contract.auditPrompt).toContain('SUPERFICIE TOTAL DE SUELOS ACABADOS: 24m²');
    expect(contract.auditPrompt).toContain('S-01 | escalera straight');
    expect(contract.auditPrompt).toContain('C-01 | columna');
    expect(contract.prompt).not.toContain('F-01');
    expect(contract.prompt).toContain('superficie total de suelos acabados es 24 metros cuadrados');
  });
});
