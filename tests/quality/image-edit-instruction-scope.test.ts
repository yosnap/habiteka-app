/**
 * Un retoque sobre una zona marcada puede quitar o añadir sanitarios y muebles: el ámbito que lee Jev solo nombraba
 * puertas, ventanas y piscinas, y bloqueaba peticiones claras como dejar un solo inodoro donde la imagen tiene tres.
 */
import { describe, expect, it } from 'vitest';
import { buildInstructionEvidence } from '@/server/quality/evidence/instruction-evidence';
import { CHANGE_INSTRUCTION } from '@/server/quality/checkpoints-instruction';

describe('ámbito de un retoque de imagen', () => {
  it('admite quitar o añadir sanitarios y muebles en la zona marcada aunque difieran del plano', () => {
    const zone = { id: 'baño', bbox: { x: 0.2, y: 0.1, width: 0.1, height: 0.1 } };
    const evidence = buildInstructionEvidence('render3d', 'aquí hay 3 retretes y 2 lavabos, deja solamente uno de cada', undefined, zone);
    expect(evidence.evidenceVersion).toBe('instruction-selection-v2');
    expect(evidence.deliverableScope).toMatch(/sanitary fixtures \(toilets, washbasins/);
    expect(evidence.deliverableScope).toMatch(/may differ from the plan/);
    expect(evidence.imageSelection?.scope).toBe('region');
    for (const id of ['specific', 'compatible', 'feasible'] as const)
      expect(CHANGE_INSTRUCTION.questions[id]!.build(evidence).instructions).toMatch(/asking to keep fewer/);
  });
});
