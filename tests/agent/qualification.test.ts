import { describe, it, expect } from 'vitest';
import { runQualification } from '@/server/agent/phases/cualificacion';
import type { ChatVisionAdapter, ChatResult, Collected } from '@/lib/contracts';

// Chat que va emitiendo tool-calls de una cola predefinida, un turno por llamada.
function scriptedChat(script: ChatResult[]): ChatVisionAdapter {
  let i = 0;
  return {
    chat: async () =>
      script[i++] ?? { content: '', usage: { promptTokens: 0, completionTokens: 0 } },
    chatStream: async function* () {},
  };
}

function toolResult(calls: Array<{ name: string; args?: Record<string, unknown> }>): ChatResult {
  return {
    content: '',
    toolCalls: calls.map((c, idx) => ({ id: `c${idx}`, name: c.name, arguments: c.args ?? {} })),
    usage: { promptTokens: 0, completionTokens: 0 },
  };
}

const empty: Collected = { entregables: [] };

describe('runQualification — loop tool-calling', () => {
  it('consolida objetivo, estilo y entregables y finaliza', async () => {
    const chat = scriptedChat([
      toolResult([{ name: 'set_objetivo', args: { objetivo: 'modernizar' } }]),
      toolResult([{ name: 'set_estilo', args: { estilo: 'nordico' } }]),
      toolResult([{ name: 'set_entregables', args: { entregables: ['plano2d', 'render3d'] } }]),
      toolResult([{ name: 'finalizar' }]),
    ]);
    const { collected, finalized } = await runQualification(chat, [], empty);
    expect(finalized).toBe(true);
    expect(collected.objetivo).toBe('modernizar');
    expect(collected.estilo).toBe('nordico');
    expect(collected.entregables).toEqual(['plano2d', 'render3d']);
  });

  it('ignora un estilo no permitido (no corrompe el estado)', async () => {
    const chat = scriptedChat([
      toolResult([{ name: 'set_estilo', args: { estilo: 'galactico' } }]),
      toolResult([{ name: 'finalizar' }]),
    ]);
    const { collected } = await runQualification(chat, [], empty);
    expect(collected.estilo).toBeUndefined();
  });

  it('sin tool-calls (el modelo pregunta en texto) no finaliza', async () => {
    const chat = scriptedChat([
      { content: '¿Qué estilo prefieres?', usage: { promptTokens: 0, completionTokens: 0 } },
    ]);
    const { finalized } = await runQualification(chat, [], empty);
    expect(finalized).toBe(false);
  });
});
