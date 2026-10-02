import { describe, expect, it } from 'vitest';
import { appendStudioResult, studioResults } from '@/lib/studio-results';
import type { StudioState } from '@/lib/studio-state';

describe('historial del estudio de planos', () => {
  it('recupera referencias anteriores sin atribuirles una fecha falsa', () => {
    const state: StudioState = {
      source: { assetKey: 'source-1', assetUrl: 'https://firmada/vieja' },
      plan: { assetKey: 'redraw-1', assetUrl: 'https://firmada/vieja-2' },
      redraws: { tecnico: { assetKey: 'redraw-1', assetUrl: 'https://firmada/vieja-2' } },
      cenital: { assetKey: 'render-1', assetUrl: 'https://firmada/vieja-3' },
      vista: 'maqueta',
    };
    const results = studioResults(state);
    expect(results).toMatchObject([
      { kind: 'source', assetKey: 'source-1', createdAt: null },
      { kind: 'redraw', assetKey: 'redraw-1', sourceKey: 'source-1', mode: 'tecnico' },
      { kind: 'render', assetKey: 'render-1', vista: 'maqueta' },
    ]);
    expect(JSON.stringify(results)).not.toContain('firmada');
  });

  it('conserva generaciones sucesivas y solo persiste claves estables', () => {
    const source = { assetKey: 'source-1', assetUrl: 'https://firmada/original' };
    const state: StudioState = { source, plan: source };
    const first = appendStudioResult(
      state,
      { assetKey: 'redraw-1', assetUrl: 'https://firmada/1' },
      {
        kind: 'redraw',
        mode: 'tecnico',
        sourceKey: 'source-1',
      },
    );
    const second = appendStudioResult(
      { ...state, results: first },
      {
        assetKey: 'redraw-2',
        assetUrl: 'https://firmada/2',
      },
      { kind: 'redraw', mode: 'tecnico', sourceKey: 'source-1' },
    );
    expect(second.map((item) => item.assetKey)).toEqual(['source-1', 'redraw-1', 'redraw-2']);
    expect(second[2]?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(JSON.stringify(second)).not.toContain('firmada');
  });

  it('no duplica resultados y no finge historial si falta una clave de almacenamiento', () => {
    const source = { assetKey: 'source-1', assetUrl: 'url' };
    const state: StudioState = { source };
    expect(appendStudioResult(state, source, { kind: 'source' })).toHaveLength(1);
    expect(
      appendStudioResult(state, { assetUrl: 'url-temporal' }, { kind: 'render' }),
    ).toHaveLength(1);
  });
});
