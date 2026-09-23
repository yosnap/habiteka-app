/**
 * Evidencia estructural que se manda a Jev antes de gastar en una generación
 * desde el editor: números y listas cortas sacados del propio documento, nunca
 * imágenes. Se comprueba sobre un plano sano (sala cerrada dibujada con las
 * mismas operaciones que el editor) y sobre uno roto (contorno abierto, hueco
 * huérfano, muro degenerado y escalera incoherente).
 */
import { describe, expect, it } from 'vitest';
import { addOpening, addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument, type EditorDocument } from '@/lib/editor-document/schema';
import { buildEditorEvidence } from '@/server/quality/evidence/editor-evidence';

const CORNERS = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];

/** Sala cerrada con una puerta en el muro sur. */
function healthy(): EditorDocument {
  const room = addWallPath(emptyEditorDocument(), CORNERS, true);
  return addOpening(room, room.walls[0]!.id, { x: 2000, y: 0 }, 'puerta');
}

describe('buildEditorEvidence', () => {
  it('un plano sano se describe sin defectos estructurales', () => {
    const evidence = buildEditorEvidence(healthy());
    expect(evidence).toMatchObject({
      niveles: 1,
      muros: 4,
      murosDegenerados: 0,
      extremosSueltos: 0,
      pasosAbiertos: 0,
      estancias: 1,
      estanciasDerivables: true,
      topologiaValida: true,
      falloGeometria: null,
      huecos: 1,
      huecosSinMuro: 0,
      huecosFueraDeMuro: 0,
      escalerasIncoherentes: 0,
      rampasIncoherentes: 0,
    });
    expect(evidence.elementosContrato).toBeGreaterThan(0);
    expect(evidence.superficieSueloM2).toBeCloseTo(12, 0);
  });

  it('no incluye geometría cruda: solo números, booleanos y un motivo corto', () => {
    const serialized = JSON.stringify(buildEditorEvidence(healthy()));
    expect(serialized).not.toContain('startVertexId');
    expect(serialized.length).toBeLessThan(1000);
  });

  it('un plano roto delata contorno abierto, hueco huérfano y muro degenerado', () => {
    const base = healthy();
    const dangling = addWallPath(base, [
      { x: 0, y: 3000 },
      { x: 0, y: 3000.5 },
    ]);
    const broken: EditorDocument = {
      ...dangling,
      openings: [
        { ...base.openings[0]!, wallId: 'inexistente' },
        { ...base.openings[0]!, id: 'o2', position: 0.98, widthMm: 2000 },
      ],
      stairs: [
        {
          id: 's1',
          x: 1000,
          y: 1000,
          kind: 'straight',
          catalogId: 'builtin:stair-straight',
          widthMm: 900,
          depthMm: 2000,
          heightMm: 0,
          elevationMm: 0,
          rotation: 0,
          stepCount: 0,
          materialId: 'concrete-grey',
        },
      ],
    };
    const evidence = buildEditorEvidence(broken);
    expect(evidence.extremosSueltos).toBeGreaterThan(0);
    expect(evidence.murosDegenerados).toBe(1);
    expect(evidence.huecosSinMuro).toBe(1);
    expect(evidence.huecosFueraDeMuro).toBe(1);
    expect(evidence.escalerasIncoherentes).toBe(1);
  });

  it('con muros medidos en la imagen y sin calibración, la escala no se da por conocida', () => {
    const base = healthy();
    const evidence = buildEditorEvidence({
      ...base,
      calibration: null,
      walls: base.walls.map((item) => ({ ...item, dimensionalOrigin: 'raster' as const })),
    });
    expect(evidence.escalaConocida).toBe(false);
    expect(evidence.murosSinMedidaFisica).toBe(4);
  });

  it('un tabique que deja un paso sin puerta es un paso abierto, no un defecto', () => {
    // Sala cerrada + tabique interior que arranca del muro norte y se queda a 1,2 m del sur.
    const room = addWallPath(emptyEditorDocument(), CORNERS, true);
    const partition = addWallPath(room, [{ x: 2000, y: 0 }, { x: 2000, y: 1800 }], false);
    const evidence = buildEditorEvidence(partition);
    expect(evidence.pasosAbiertos).toBe(1);
    expect(evidence.extremosSueltos).toBe(0);
  });
  it('un muro que casi toca otro sigue siendo un extremo suelto', () => {
    const room = addWallPath(emptyEditorDocument(), CORNERS, true);
    const nearMiss = addWallPath(room, [{ x: 2000, y: 0 }, { x: 2000, y: 2700 }], false);
    expect(buildEditorEvidence(nearMiss).extremosSueltos).toBe(1);
  });
});
