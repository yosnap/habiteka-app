import { describe, expect, it } from 'vitest';
import { EDITOR_STRUCTURE } from '@/server/quality/checkpoints';
import { combineAnswers } from '@/server/quality/scoring';
import { explainEditorEvidence, type EditorEvidence } from '@/server/quality/evidence/editor-evidence';
import type { JevQuestion } from '@/server/quality/jev-client';

const CLEAN: EditorEvidence = {
  niveles: 1, muros: 12, murosDegenerados: 0, extremosSueltos: 0, pasosAbiertos: 0, murosSinMedidaFisica: 0, estancias: 5,
  estanciasDerivables: true, topologiaValida: true, falloGeometria: null, huecos: 6, huecosSinMuro: 0,
  huecosFueraDeMuro: 0, escalaConocida: true, suelos: 5, suelosSinEstancia: 0, plataformasElevadas: 0,
  accesosVerticales: 0, escalerasIncoherentes: 0, rampasIncoherentes: 0, muebles: 0, columnas: 0,
  elementosContrato: 20, superficieSueloM2: 80,
};
const QUESTIONS = Object.fromEntries(
  Object.entries(EDITOR_STRUCTURE.questions).map(([id, spec]) => [id, spec.build(CLEAN)]),
) as Record<string, JevQuestion>;

describe('por qué la fiabilidad no es alta', () => {
  it('sin ningún «no» claro explica las dudas que más restan', () => {
    const combined = combineAnswers(EDITOR_STRUCTURE, QUESTIONS, {
      geometry_sound: { type: 'score', score: 3 },
      rooms_closed: { type: 'noul', noul: 0.95 },
      openings_anchored: { type: 'noul', noul: 0.6 },
      scale_known: { type: 'noul', noul: 0.7 },
      levels_coherent: { type: 'noul', noul: 1 },
      main_issue: { type: 'choice', choice: 'none' },
    });
    expect(combined.reasons).toEqual([
      'Puede que alguna puerta o ventana no encaje bien en su muro.',
      'Las medidas pueden no ser exactas: parte del plano se midió sobre la imagen.',
    ]);
  });

  it('con un fallo claro solo muestra el fallo', () => {
    const combined = combineAnswers(EDITOR_STRUCTURE, QUESTIONS, {
      rooms_closed: { type: 'noul', noul: 0.2 },
      scale_known: { type: 'noul', noul: 0.7 },
    });
    expect(combined.reasons).toEqual(['Hay estancias sin cerrar: los muros no forman recintos completos.']);
  });

  it('traduce la evidencia medida a hechos concretos', () => {
    expect(explainEditorEvidence({ ...CLEAN, extremosSueltos: 3, huecosFueraDeMuro: 1,
      murosSinMedidaFisica: 4, escalaConocida: false })).toEqual([
      '3 extremos de muro no se unen a ningún otro muro.',
      '4 de 12 muros tienen medidas tomadas de la imagen y el plano no tiene escala definida.',
      '1 puerta o ventana sobresale de su muro.',
    ]);
  });

  it('sin defectos medibles lo dice en vez de callar', () => {
    expect(explainEditorEvidence(CLEAN)).toHaveLength(1);
    expect(explainEditorEvidence(CLEAN)[0]).toMatch(/ningún defecto concreto/);
  });
});
