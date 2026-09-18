import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { addLuminaire, applyLightingProposal, setRoomCeiling } from '@/lib/editor-document/ceiling-commands';
import { proposeLighting } from '@/lib/editor-document/lighting-proposal';
import { luminairePlacementIssue, resolvedLuminaires } from '@/lib/editor-document/ceiling-geometry';
import { createEditorStore } from '@/canvas/editor-v2/store';

function room(concave = false) {
  const points = concave ? [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 2000 }, { x: 2000, y: 2000 }, { x: 2000, y: 6000 }, { x: 0, y: 6000 }] : [{ x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 6000 }, { x: 0, y: 6000 }];
  const doc = addWallPath(emptyEditorDocument(), points, true);
  return setRoomCeiling(doc, deriveRooms(doc)[0]!.id, { kind: 'suspended', dropMm: 150 });
}

describe('propuesta geométrica revisable de iluminación', () => {
  it('distingue moderno y mediterráneo sin crear entidades antes de aceptar', () => {
    const doc = room(), snapshot = structuredClone(doc), id = doc.ceilings![0]!.id;
    const modern = proposeLighting(doc, id, 'Moderno'), warm = proposeLighting(doc, id, 'Mediterráneo');
    expect(modern.lights.length).toBeGreaterThan(0);
    expect(modern.lights.every((light) => light.kind === 'recessed' && light.temperatureK === 3000)).toBe(true);
    expect(warm.lights.every((light) => light.kind === 'flush' && light.temperatureK === 2700)).toBe(true);
    expect(doc).toEqual(snapshot);
    expect(proposeLighting(doc, id, 'Moderno')).toEqual(modern);
  });
  it('encaja en habitación cóncava sin colocar luces en el vacío de la L', () => {
    const doc = room(true), proposal = proposeLighting(doc, doc.ceilings![0]!.id, 'moderno');
    const accepted = applyLightingProposal(doc, proposal);
    expect(accepted.luminaires!.length).toBeGreaterThan(0);
    for (const light of accepted.luminaires!) {
      expect(light.x > 2000 && light.y > 2000).toBe(false);
      expect(luminairePlacementIssue(accepted, light)).toBeNull();
    }
  });
  it('aplica atómicamente, conserva luces previas y permite deshacer toda la propuesta', () => {
    const doc = room(), lit = addLuminaire(doc, doc.ceilings![0]!.id, 'flush', { x: 1000, y: 1000 });
    const proposal = proposeLighting(lit, lit.ceilings![0]!.id, 'mediterráneo');
    const accepted = applyLightingProposal(lit, proposal), store = createEditorStore(lit);
    expect(accepted.luminaires).toContainEqual(lit.luminaires![0]);
    expect(resolvedLuminaires(accepted)).toHaveLength(accepted.luminaires!.length);
    store.getState().apply(accepted); store.getState().undo(); expect(store.getState().document).toEqual(lit);
    store.getState().redo(); expect(store.getState().document).toEqual(accepted);
  });
  it('revalida propuestas obsoletas contra nuevas luces y rechaza la propuesta entera', () => {
    const doc = room(), id = doc.ceilings![0]!.id, proposal = proposeLighting(doc, id, 'moderno');
    const stale = addLuminaire(doc, id, 'flush', proposal.lights[0]), snapshot = structuredClone(stale);
    expect(() => applyLightingProposal(stale, proposal)).toThrow('superpongan');
    expect(stale).toEqual(snapshot);
    expect(() => applyLightingProposal(doc, { ...proposal, lights: [] })).toThrow();
    expect(() => applyLightingProposal(doc, { ...proposal, lights: [{ ...proposal.lights[0]!, ceilingId: 'foreign' }] })).toThrow('otro techo');
    const missing = structuredClone(doc); missing.ceilings = [];
    expect(() => applyLightingProposal(missing, proposal)).toThrow('disponible');
  });
  it('solo propone colgantes sobre mesas físicas confirmadas', () => {
    const doc = room(); doc.furniture.push({ id: 'table', color: '#ffffff', elevationMm: 0, kind: 'table', x: 2000, y: 2000, widthMm: 1600, depthMm: 900, heightMm: 750, rotation: 0, dimensionalOrigin: 'physical' });
    const proposal = proposeLighting(doc, doc.ceilings![0]!.id, 'mediterráneo');
    expect(proposal.lights).toContainEqual(expect.objectContaining({ kind: 'pendant', x: 2800, y: 2450 }));
    doc.furniture[0]!.dimensionalOrigin = 'raster';
    expect(proposeLighting(doc, doc.ceilings![0]!.id, 'mediterráneo').lights.some((light) => light.kind === 'pendant')).toBe(false);
  });
});
