import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { designPlanContext } from '@/server/agent/feedback/design-plan-context';
import { renderReferenceMetadata } from '@/server/agent/feedback/feedback-orchestrator';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addOpening, addWallPath } from '@/canvas/editor-v2/editing-operations';
import { buildInstructionEvidence } from '@/server/quality/evidence/instruction-evidence';
import { directedInpaint } from '@/server/agent/feedback/directed-inpaint';
import type { ImageAdapter, InpaintRequest } from '@/lib/contracts';

describe('contexto de estancias en cambios de imagen', () => {
  it('envía el nombre y contorno de la estancia sin convertir coordenadas del plano en píxeles', () => {
    const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }], true);
    doc.labels.push({ id: 'label', x: 2000, y: 1500, text: 'Cocina' });
    const context = designPlanContext(doc);
    expect(context.rooms[0]).toMatchObject({ name: 'Cocina', x: 2000, y: 1500 });
    expect(context.rooms[0]?.boundary).toHaveLength(4);
    expect(buildInstructionEvidence('render3d', 'Pon los elementos en las estancias con su nombre', context).planContext).toEqual(context);
  });

  it('envía huecos sin puerta, barridos e inventario de piscinas al retoque', () => {
    let doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }], true);
    doc = addOpening(doc, doc.walls[0]!.id, { x: 2000, y: 0 }, 'hueco');
    doc = addOpening(doc, doc.walls[2]!.id, { x: 2000, y: 3000 }, 'puerta');
    doc.labels = [{ id: 'hall', x: 500, y: 1500, text: 'Pasillo' }, { id: 'laundry', x: 3000, y: 1500, text: 'Lavadero' }];
    const context = designPlanContext(doc);
    expect(context.openings).toEqual([expect.objectContaining({ kind: 'hueco' }), expect.objectContaining({ kind: 'puerta', swingClearance: expect.any(Object) })]);
    expect(context.openAreas[0]!.names).toEqual(['Pasillo', 'Lavadero']);
    expect(context.pools).toEqual([]);
  });

  it('conserva cámara y generación sin heredar un asset antiguo ni una aceptación', () => {
    const camera = { position: [0, 10, 0] }, generation = { documentRevision: 16 };
    expect(renderReferenceMetadata({ camera, generation, assetKey: 'old.png', assetUrl: 'old', accepted: true }))
      .toEqual({ camera, generation });
    expect(renderReferenceMetadata({ camera, generation: { ...generation,
      acceptance: { userId: 'owner', acceptedAt: '2026-10-03T10:00:00Z' },
      fidelity: { status: 'passed' }, review: { status: 'rejected' } } }))
      .toEqual({ camera, generation });
  });

  it('incluye las estancias en el retoque y mantiene la restricción de la máscara', async () => {
    const inpaint = vi.fn(async (request: InpaintRequest) => { expect(request.baseImage).toEqual({ url: 'base' }); return { assetUrl: 'new', cost: { amount: 0, currency: 'USD' } }; });
    await directedInpaint({ inpaint } as unknown as ImageAdapter, { baseImage: { url: 'base' },
      zone: { id: 'zone', bbox: { x: .1, y: .1, width: .2, height: .2 } },
      instruction: 'Coloca los elementos según el nombre de las estancias', planContext: { rooms: [{ name: 'Cocina' }] } });
    expect(inpaint.mock.calls[0]?.[0]).toMatchObject({ baseImage: { url: 'base' } });
    const prompt = (inpaint.mock.calls as unknown as [{ prompt: string }][])[0]![0].prompt;
    expect(prompt).toContain('Cocina');
    expect(prompt).toContain('masked region');
    expect(prompt).toContain('outside the selected mask');
  });
});
