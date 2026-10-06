/**
 * La IA propone con libertad y la validación física solo protege lo imposible: si rechaza algo, el modelo recibe el
 * motivo y corrige una vez, en lugar de recibir posiciones prefabricadas.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import type { ChatRequest, ChatVisionAdapter } from '@/lib/contracts';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addOutdoorArea } from '@/lib/editor-document/outdoor-area';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { proposeNativeDesign } from '@/server/agent/editor-v2/native-design-proposal';
import { OpenRouterChatVisionAdapter } from '@/server/ai/chat-vision-adapter';
import { setClientFactory } from '@/server/ai/client/gateway-client';

let restoreClient: (() => void) | undefined;
afterEach(() => { restoreClient?.(); restoreClient = undefined; });

const materials = { walls: 'none', floors: 'none', slabUndersides: 'none', stairBodies: 'none', rampBodies: 'none',
  landingBodies: 'none', stairs: 'none', ramps: 'none', columns: 'none' };
// La IA escribe el centro de la huella; el plano guarda la esquina, que es lo que comprueban los tests.
const PLANTER = getFurnitureCatalogEntry('habiteka:furniture:jardinera')!;
const planter = (xMm: number, yMm: number) => ({ catalogId: PLANTER.id, cxMm: xMm + PLANTER.widthMm / 2, cyMm: yMm + PLANTER.depthMm / 2,
  rotation: 0, reason: 'Vegetación' });
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
    // El endpoint puede exigir razonamiento, también al corregir; la geometría exacta sigue validada por código.
    expect(requests.map(({ reasoning, maxTokens }) => [reasoning, maxTokens])).toEqual([[{ effort: 'low' }, 16000], [{ effort: 'low' }, 16000]]);
    const correction = requests[1]!.messages.at(-1)!.content.map((part) => ('text' in part ? part.text : '')).join('');
    expect(correction).toContain('junto a un muro o al borde');
    expect(proposal.furniture.map(({ xMm, yMm }) => [xMm, yMm])).toEqual([[5000, 3400]]);
  });

  it.each([false, true])('propone y corrige con un endpoint que exige razonamiento (OpenAI=%s)', async (openAiApi) => {
    const bodies: Record<string, unknown>[] = [];
    const replies = [answer([planter(6200, 1700)]), answer([planter(5000, 3400)])];
    const previous = setClientFactory(() => ({ chat: { completions: { create: async (body: Record<string, unknown>) => {
      bodies.push(body);
      if (openAiApi ? body.reasoning_effort !== 'low' : (body.reasoning as { effort?: string })?.effort !== 'low') {
        throw new Error('400 Reasoning is mandatory for this endpoint and cannot be disabled.');
      }
      return { choices: [{ message: { content: JSON.stringify(replies[bodies.length - 1]!.structured) } }], usage: {} };
    } } } }) as never);
    restoreClient = () => { setClientFactory(previous); };
    const adapter = new OpenRouterChatVisionAdapter({ apiKey: 'test-key', openAiApi });
    const proposal = await proposeNativeDesign(adapter, patio(), 'moderno', '', '', [], options);
    expect(bodies).toHaveLength(2);
    for (const body of bodies) {
      expect(body[openAiApi ? 'max_completion_tokens' : 'max_tokens']).toBe(16000);
      expect(body).not.toHaveProperty('reasoning.enabled');
    }
    expect(proposal.furniture.map(({ xMm, yMm }) => [xMm, yMm])).toEqual([[5000, 3400]]);
  });

  it('pide amueblar por completo sin cupo de objetos y repetir solo lo que el uso exige', async () => {
    const { chat, requests } = scripted([answer([planter(5000, 3400)]), { structured: { issues: [] } } as never]);
    await proposeNativeDesign(chat, patio(), 'moderno', '', '', [], options);
    const prompt = (requests[0]!.messages[0]!.content[0] as { text: string }).text;
    expect(prompt).not.toMatch(/hasta \d+ objetos/);
    expect(prompt).toContain('amuebla y decora cada estancia elegida por completo');
    expect(prompt).toContain('Repite un objeto solo cuando el uso lo pide');
  });

  it('con una propuesta válida que Jev da por buena no pide corrección', async () => {
    const { chat, requests } = scripted([answer([planter(5000, 3400)]), { structured: { issues: [] } } as never]);
    const proposal = await proposeNativeDesign(chat, patio(), 'moderno', '', '', [], options);
    expect(requests).toHaveLength(2);
    expect(JSON.stringify(requests[1]!.responseSchema)).toContain('issues');
    expect(proposal.furniture).toHaveLength(1);
  });

  it('corrige la distribución que Jev señala sobre la planta con la propuesta dibujada', async () => {
    const { chat, requests } = scripted([answer([planter(5000, 3400)]),
      { structured: { issues: [{ item: 1, problem: 'Tapa el paso hacia la casa; muévela junto al borde' }] } } as never,
      answer([planter(5000, 3400)])]);
    const proposal = await proposeNativeDesign(chat, patio(), 'moderno', '', '', [], options);
    expect(requests).toHaveLength(3);
    expect(requests[1]!.messages[0]!.content.some((part) => part.type === 'image_url')).toBe(true);
    const correction = requests[2]!.messages.at(-1)!.content.map((part) => ('text' in part ? part.text : '')).join('');
    expect(correction).toContain('La revisión de distribución (Jev)');
    expect(correction).toContain('Tapa el paso hacia la casa');
    expect(proposal.furniture).toHaveLength(1);
  });

  it('conserva lo que Jev señala si la corrección no trae un sustituto', async () => {
    const { chat } = scripted([answer([planter(5000, 3400)]),
      { structured: { issues: [{ item: 1, problem: 'Mejor junto a la casa' }] } } as never, answer([])]);
    const proposal = await proposeNativeDesign(chat, patio(), 'moderno', '', '', [], options);
    expect(proposal.furniture.map(({ xMm, yMm }) => [xMm, yMm])).toEqual([[5000, 3400]]);
  });

  it('conserva las piezas válidas y de la corrección solo toma los sustitutos', async () => {
    const { chat, requests } = scripted([answer([planter(5000, 3400), planter(6200, 1700)]), { structured: { issues: [] } } as never,
      answer([planter(4200, 600)])]);
    const proposal = await proposeNativeDesign(chat, patio(), 'moderno', '', '', [], options);
    const correction = requests[2]!.messages.at(-1)!.content.map((part) => ('text' in part ? part.text : '')).join('');
    expect(correction).toContain('SOLO los objetos que sustituyen');
    expect(proposal.furniture.map(({ xMm, yMm }) => [xMm, yMm])).toEqual([[5000, 3400], [4200, 600]]);
  });

  it('conserva la primera propuesta si la corrección es peor', async () => {
    const { chat } = scripted([answer([planter(5000, 3400), planter(6200, 1700)]), answer([])]);
    const proposal = await proposeNativeDesign(chat, patio(), 'moderno', '', '', [], options);
    expect(proposal.furniture.map(({ xMm, yMm }) => [xMm, yMm])).toEqual([[5000, 3400]]);
  });

  it('conserva la primera propuesta si la consulta de corrección falla', async () => {
    let calls = 0;
    const chat = {
      // La tercera llamada es la corrección: antes va la revisión de Jev, que no encuentra problemas.
      chat: async () => { calls++; if (calls === 3) throw new Error('La salida no es JSON válido contra el schema'); return answer([planter(5000, 3400), planter(6200, 1700)]); },
      chatStream: () => ({ [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true, value: undefined }) }) }),
    } as unknown as ChatVisionAdapter;
    const proposal = await proposeNativeDesign(chat, patio(), 'moderno', '', '', [], options);
    expect(calls).toBe(3);
    expect(proposal.furniture.map(({ xMm, yMm }) => [xMm, yMm])).toEqual([[5000, 3400]]);
  });
});
