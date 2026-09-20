import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { setDesignSpaceKind } from '@/lib/editor-document/spatial-properties';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { editorDesignContext } from '@/lib/editor-document/design-context';
import { buildEditorRenderContract } from '@/lib/editor-document/render-contract';
import { conceptRenderPrompt } from '@/server/agent/editor-v2/concept-render-prompt';
import { selectedViewPrompt } from '@/server/agent/editor-v2/selected-view-prompt';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import type { RenderView } from '@/lib/editor-document/render-view';

const view: RenderView = { preset: 'isometric', position: [5, 5, 5], quaternion: [0, 0, 0, 1], fov: 45, aspect: 1.5, allLevels: false, cutaway: true };
function roomWithLighting() {
  const doc = addWallPath(setDesignSpaceKind(emptyEditorDocument(), 'interior'), [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 4000 }, { x: 0, y: 4000 }], true);
  doc.schemaVersion = 8; doc.ceilings = []; doc.luminaires = [];
  doc.designSpaceKind = 'interior';
  doc.ceilings = [{ id: 'ceiling', roomId: deriveRooms(doc)[0]!.id, kind: 'suspended', dropMm: 200, color: '#fffafa' }];
  doc.luminaires = [{ id: 'pendant', ceilingId: 'ceiling', kind: 'pendant', x: 2100, y: 1900, dropMm: 100, color: '#c9ac70', temperatureK: 2700, lumens: 800, enabled: false }];
  return doc;
}
function compactPayload(prompt: string) {
  const data = JSON.parse(prompt.slice(prompt.indexOf('{"schemas"')));
  const decode = (value: unknown): unknown => {
    if (!Array.isArray(value)) return value;
    if (typeof value[0] === 'string' && /^@\d+$/.test(value[0])) {
      return Object.fromEntries((data.schemas[Number(value[0].slice(1))] as string[])
        .map((key, index) => [key, decode(value[index + 1])]));
    }
    return value.map(decode);
  };
  return decode(data.values);
}

describe('techos y luminarias en prompts de diseño', () => {
  it('conserva soporte, caída, altura, acabado y luz apagada en unidades correctas', () => {
    const doc = roomWithLighting();
    const before = JSON.stringify(doc);
    const level = editorDesignContext(doc).levels[0]!;
    expect(level.ceilings[0]).toMatchObject({ id: 'ceiling', kind: 'suspended', heightM: 2.5, dropM: 0.2, color: '#fffafa' });
    expect(level.ceilings[0]!.boundaryM).toHaveLength(4);
    expect(level.luminaires[0]).toMatchObject({ ceilingId: 'ceiling', positionM: { x: 2.1, y: 1.9, elevation: 2.18 }, ceilingHeightM: 2.5, dropM: 0.1, temperatureK: 2700, lumens: 800, enabled: false });
    const contract = buildEditorRenderContract(doc);
    expect(contract.elements.find(item => item.sourceId === 'pendant')).toMatchObject({ position: { elevation: 2.18 }, attributes: { temperatureK: 2700, lumens: 800, enabled: false } });
    expect(contract.prompt).toContain('temperatureK=2700');
    expect(contract.prompt).toContain('nunca un material de cristal');
    expect(JSON.stringify(doc)).toBe(before);
  });
  it.each(['moderno', 'mediterraneo'] as const)('incluye las luces aceptadas en modo estricto y compacto, estilo %s', (style) => {
    const doc = roomWithLighting();
    const full = selectedViewPrompt(doc, view, style);
    expect(full).toContain('MODO ESTRICTO: no añadas ningún elemento nuevo.');
    expect(full).toContain('sin borrar luminarias');
    expect(full).toContain('"temperatureK":2700');
    const compact = selectedViewPrompt(doc, view, style, '', '', undefined, true);
    expect(compact).toContain('nunca un material de cristal');
    expect(compactPayload(compact)).toMatchObject({ designOptions: { additions: [] }, levels: [{ ceilings: [{ heightM: 2.5 }], luminaires: [{ positionM: [2.1, 1.9, 2.18], enabled: false, lumens: 800, temperatureK: 2700 }] }] });
  });
  it('limita luces nuevas a categoría y zonas autorizadas en ambas rutas', () => {
    const options = { ...defaultRenderDesignOptions(), freedom: 'controlled' as const, additions: ['lights' as const], placement: 'selected' as const,
      regions: [{ id: 'zone', name: 'Sala', polygon: [{ x: 1000, y: 1000 }, { x: 4000, y: 1000 }, { x: 2000, y: 3000 }] }] };
    for (const compact of [false, true]) {
      const prompt = selectedViewPrompt(roomWithLighting(), view, 'moderno', '', '', options, compact);
      expect(prompt).toContain('solo propón luces si additions incluye lights y dentro de las zonas autorizadas');
    }
  });
  it('no infiere techo ni luces en documentos anteriores o patios cerrados', () => {
    const doc = roomWithLighting();
    delete doc.ceilings; delete doc.luminaires; doc.schemaVersion = 7; doc.designSpaceKind = 'patio';
    expect(editorDesignContext(doc).levels[0]).toMatchObject({ ceilings: [], luminaires: [] });
  });
  it('conserva techo y luces en la ruta conceptual sin captura', () => {
    const prompt = conceptRenderPrompt(roomWithLighting(), 'mediterraneo');
    expect(prompt).toContain('Habitación interior');
    expect(prompt).toContain('"temperatureK":2700');
    expect(prompt).toContain('nunca un material de cristal');
    expect(prompt).not.toContain('exterior de una casa');
  });
  it('conserva luces por planta y filtra plantas no visibles', () => {
    const doc = roomWithLighting(), ground = roomWithLighting();
    ground.luminaires![0]!.id = 'ground-light';
    doc.activeLevelId = 'upper';
    doc.levels = [{ id: 'ground', name: 'Baja', heightMm: 3000, document: ground }, { id: 'upper', name: 'Alta', heightMm: 3000 }];
    expect(selectedViewPrompt(doc, view, 'moderno')).not.toContain('ground-light');
    expect(selectedViewPrompt(doc, { ...view, allLevels: true }, 'moderno')).toContain('ground-light');
  });
});
