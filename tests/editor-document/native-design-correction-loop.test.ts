/**
 * La IA propone con libertad y la validación física solo protege lo imposible: si rechaza algo, el modelo recibe el
 * motivo y corrige una vez, en lugar de recibir posiciones prefabricadas.
 */
import { describe, expect, it } from 'vitest';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import type { ChatRequest, ChatVisionAdapter } from '@/lib/contracts';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addOutdoorArea } from '@/lib/editor-document/outdoor-area';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { proposeNativeDesign } from '@/server/agent/editor-v2/native-design-proposal';

const materials = { walls: 'none', floors: 'none', slabUndersides: 'none', stairBodies: 'none', rampBodies: 'none',
  landingBodies: 'none', stairs: 'none', ramps: 'none', columns: 'none' };
const planter = (xMm: number, yMm: number) => ({ catalogId: 'habiteka:furniture:jardinera', xMm, yMm, rotation: 0, reason: 'Vegetación' });
const answer = (furniture: unknown[]) => ({ structured: { summary: 'Patio', materials, furniture } });
// Casa de 4000 × 4000 y un patio abierto de 5000 × 4000 a su derecha.
const patio = () => upgradeSpatialDocument(addOutdoorArea(
  addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }], true),
  { x: 4000, y: 0 }, { x: 9000, y: 4000 }));
const options = { ...defaultRenderDesignOptions(), freedom: 'controlled' as const, additions: ['plants' as const], designScope: 'exterior' as const };
const scripted = (replies: ReturnType<typeof answer>[]) => {
  const requests: ChatRequest[] = [];
  const chat = {
    chat: async (request: ChatRequest) => { requests.push(request); return replies[requests.length - 1] ?? replies.at(-1)!; },
    chatStream: () => ({ [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true, value: undefined }) }) }),
  } as unknown as ChatVisionAdapter;
  return { chat, requests };
};

describe('propuesta de diseño con corrección', () => {
  it('devuelve al modelo el motivo del rechazo y usa su segunda propuesta', async () => {
    const { chat, requests } = scripted([answer([planter(6200, 1700)]), answer([planter(5000, 3400)])]);
    const proposal = await proposeNativeDesign(chat, patio(), 'moderno', '', '', [], options);
    expect(requests).toHaveLength(2);
    const correction = requests[1]!.messages.at(-1)!.content.map((part) => ('text' in part ? part.text : '')).join('');
    expect(correction).toContain('junto a un muro o al borde');
    expect(proposal.furniture.map(({ xMm, yMm }) => [xMm, yMm])).toEqual([[5000, 3400]]);
  });

  it('no gasta una segunda consulta si la primera propuesta ya es válida', async () => {
    const { chat, requests } = scripted([answer([planter(5000, 3400)])]);
    const proposal = await proposeNativeDesign(chat, patio(), 'moderno', '', '', [], options);
    expect(requests).toHaveLength(1);
    expect(proposal.furniture).toHaveLength(1);
  });

  it('conserva la primera propuesta si la corrección es peor', async () => {
    const { chat } = scripted([answer([planter(5000, 3400), planter(6200, 1700)]), answer([])]);
    const proposal = await proposeNativeDesign(chat, patio(), 'moderno', '', '', [], options);
    expect(proposal.furniture.map(({ xMm, yMm }) => [xMm, yMm])).toEqual([[5000, 3400]]);
  });

  it('conserva la primera propuesta si la consulta de corrección falla', async () => {
    let calls = 0;
    const chat = {
      chat: async () => { calls++; if (calls === 2) throw new Error('La salida no es JSON válido contra el schema'); return answer([planter(5000, 3400), planter(6200, 1700)]); },
      chatStream: () => ({ [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true, value: undefined }) }) }),
    } as unknown as ChatVisionAdapter;
    const proposal = await proposeNativeDesign(chat, patio(), 'moderno', '', '', [], options);
    expect(calls).toBe(2);
    expect(proposal.furniture.map(({ xMm, yMm }) => [xMm, yMm])).toEqual([[5000, 3400]]);
  });
});
