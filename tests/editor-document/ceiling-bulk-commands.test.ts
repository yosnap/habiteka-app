import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { addLuminaire, applyLightingProposals, removeLuminaires, setCeilingsForAllRooms, updateLuminaires } from '@/lib/editor-document/ceiling-commands';
import { proposeLightingForPlan } from '@/lib/editor-document/lighting-proposal';

/** Dos estancias contiguas de 4×5 m separadas por un tabique. */
const twoRooms = () => {
  const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 5000 }, { x: 0, y: 5000 }], true);
  return addWallPath(doc, [{ x: 4000, y: 0 }, { x: 4000, y: 5000 }], false);
};

describe('techo y luces de toda la planta', () => {
  it('pone el mismo techo en todas las estancias de una vez', () => {
    const { document, applied, skipped } = setCeilingsForAllRooms(twoRooms(), { kind: 'suspended', dropMm: 200, color: '#ffffff' });
    expect([applied, skipped]).toEqual([2, 0]);
    expect(document.ceilings).toHaveLength(2);
    expect(document.ceilings!.every((ceiling) => ceiling.kind === 'suspended' && ceiling.dropMm === 200 && ceiling.color === '#ffffff')).toBe(true);
  });

  it('propone luces solo para los techos que no tienen y las añade en un paso', () => {
    let doc = setCeilingsForAllRooms(twoRooms()).document;
    doc = addLuminaire(doc, doc.ceilings![0]!.id, 'flush');
    const { proposals, skippedLit } = proposeLightingForPlan(doc, 'moderno');
    expect(proposals.map((proposal) => proposal.ceilingId)).toEqual([doc.ceilings![1]!.id]);
    expect(skippedLit).toBe(1);
    const lit = applyLightingProposals(doc, proposals);
    expect(lit.luminaires!.length).toBe(1 + proposals[0]!.lights.length);
    // Pedirlo expresamente también propone donde ya hay luces, sin saltarse ninguna.
    const both = proposeLightingForPlan(doc, 'moderno', { includeLit: true });
    expect(both.skippedLit).toBe(0);
    expect(both.proposals.map((proposal) => proposal.ceilingId).sort())
      .toEqual(doc.ceilings!.map((ceiling) => ceiling.id).sort());
  });

  it('cambia varias luces a la vez y es todo o nada', () => {
    let doc = setCeilingsForAllRooms(twoRooms()).document;
    doc = addLuminaire(doc, doc.ceilings![0]!.id, 'flush');
    doc = addLuminaire(doc, doc.ceilings![1]!.id, 'flush');
    const ids = doc.luminaires!.map((light) => light.id);
    const warm = updateLuminaires(doc, ids, { temperatureK: 2700, color: '#d8b982', enabled: false });
    expect(warm.luminaires!.every((light) => light.temperatureK === 2700 && light.color === '#d8b982' && !light.enabled)).toBe(true);
    // Techo plano: los focos empotrados no caben y no se cambia ninguna.
    expect(() => updateLuminaires(doc, ids, { kind: 'recessed' })).toThrow(/ninguna de las 2 luces/);
    expect(removeLuminaires(doc, ids).luminaires).toEqual([]);
  });
});
