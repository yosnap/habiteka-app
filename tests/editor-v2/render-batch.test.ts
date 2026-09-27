import { describe, expect, it } from 'vitest';
import { runRenderBatch } from '@/components/editor-v2/render-batch';

describe('runRenderBatch', () => {
  it('detiene antes de iniciar la siguiente vista', async () => {
    const calls: number[] = [];
    let stop = false;
    const state = await runRenderBatch({
      items: [0, 1, 2],
      render: async (item) => {
        calls.push(item);
        if (item === 1) stop = true;
        return { id: `r${item}`, value: `${item}` };
      },
      shouldStop: () => stop,
    });
    expect(calls).toEqual([0, 1]);
    expect(state.stopped).toBe(true);
    expect(state.results).toHaveLength(2);
  });

  it('en un reintento procesa únicamente las pendientes', async () => {
    const calls: number[] = [];
    const state = await runRenderBatch({
      items: [0, 1, 2],
      initialResults: [{ id: 'first', value: 'ok' }, undefined, { id: 'third', value: 'ok' }],
      render: async (item) => {
        calls.push(item);
        return { id: `new${item}`, value: 'ok' };
      },
      shouldStop: () => false,
    });
    expect(calls).toEqual([1]);
    expect(state.results.map((result) => result?.value)).toEqual(['ok', 'ok', 'ok']);
  });

  it('genera cada vista sin usar otra imagen del lote como referencia', async () => {
    const indices: number[] = [];
    const state = await runRenderBatch({
      items: [0, 1, 2],
      render: async (item, index) => {
        indices.push(index);
        return { id: `r${item}`, value: 'ok' };
      },
      shouldStop: () => false,
    });
    expect(indices).toEqual([0, 1, 2]);
    expect(state.results.map((result) => result?.id)).toEqual(['r0', 'r1', 'r2']);
  });

  it('devuelve el error conservando los éxitos anteriores', async () => {
    const state = await runRenderBatch({
      items: [0, 1, 2],
      render: async (item) => {
        if (item === 1) throw new Error('fallo');
        return { id: `r${item}`, value: 'ok' };
      },
      shouldStop: () => false,
    });
    expect(state.results[0]).toEqual({ id: 'r0', value: 'ok' });
    expect(state.results[1]).toBeUndefined();
    expect(state.error).toEqual(new Error('fallo'));
  });
});
