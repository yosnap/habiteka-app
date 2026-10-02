import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StudioStageNav } from '@/components/plano-studio/studio-stage-nav';
import { StudioResultsPanel } from '@/components/plano-studio/studio-results-panel';

const noop = () => {};

describe('lectura del progreso y los resultados del estudio', () => {
  it('explica las etapas pendientes sin presentarlas como pestañas rotas', () => {
    const html = renderToStaticMarkup(
      createElement(StudioStageNav, {
        hasSource: true,
        hasImport: false,
        hasEditorPlan: false,
        hasDesignImages: false,
        hasVideo: false,
      }),
    );
    expect(html).toContain('Plano editable');
    expect(html).toContain('Pendiente');
    expect(html).toContain('Visita');
  });

  it('muestra la versión y el origen de un render guardado', () => {
    const html = renderToStaticMarkup(
      createElement(StudioResultsPanel, {
        projectId: 'proyecto',
        results: [
          {
            id: 'original',
            kind: 'source',
            assetKey: 'original',
            createdAt: '2026-09-24T10:00:00.000Z',
            url: '/original',
          },
          {
            id: 'render',
            kind: 'render',
            assetKey: 'render',
            sourceKey: 'original',
            vista: 'maqueta',
            createdAt: '2026-09-24T10:01:00.000Z',
            url: '/render',
          },
        ],
        deliverables: [],
        hasImport: true,
        activeKey: 'original',
        onOpen: noop,
        onCompare: noop,
        onContinue: noop,
        onReviewImport: noop,
      }),
    );
    expect(html).toContain('Maqueta · imagen · v1');
    expect(html).toContain('Origen: original v1');
    expect(html).toContain('Extracción vectorial');
    expect(html).toContain('Comparar');
  });
});
