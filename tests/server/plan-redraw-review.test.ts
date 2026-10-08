/**
 * Redibujado del plano en la revisión de la pestaña Plano: Jev decide si hace falta, el gasto
 * usa solo la ruta autorizada y volver a leer una imagen no genera otra.
 *
 * La lectura del plano y la generación se simulan; el estudio se guarda en la BD.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrgContext } from '@/server/auth/org-context';
import type { StudioImage, StudioState } from '@/lib/studio-state';

const fixture = vi.hoisted(() => ({
  ctx: null as OrgContext | null,
  generated: 0,
  confirmedRoutes: [] as unknown[],
  reads: [] as string[],
}));

vi.mock('server-only', () => ({}));
vi.mock('@/server/auth/require-org-context', () => ({ requireOrgContext: async () => fixture.ctx }));
vi.mock('@/server/privacy/consent-service', () => ({ assertConsent: async () => {} }));
vi.mock('@/server/legal/tos-acceptance-service', () => ({ assertTosAccepted: async () => {} }));
vi.mock('@/server/storage/render-urls', () => ({
  resolveRenderUrl: async (ref: { assetKey?: string; assetUrl?: string }) => ref.assetUrl ?? `https://cdn/${ref.assetKey}`,
}));
vi.mock('@/server/plan/studio-image', () => ({
  readStudioImage: async () => ({ base64: 'AAAA', mimeType: 'image/png' }),
  persistStudioSource: async () => ({ assetUrl: 'https://cdn/boceto.png', assetKey: 'boceto.png' }),
}));
vi.mock('@/server/ai', () => ({
  getImageAdapterForAction: async (_ctx: unknown, _action: string, confirmedRoute?: unknown) => {
    fixture.confirmedRoutes.push(confirmedRoute);
    return {};
  },
  getChatVisionAdapter: async () => ({}),
}));
vi.mock('@/server/agent/editor-v2/english-image-prompt', () => ({ withEnglishPrompts: (image: unknown) => image }));
vi.mock('@/server/ai/design/redraw-plan-pipeline', () => ({
  redrawPlan: async () => {
    fixture.generated += 1;
    return { assetUrl: `https://cdn/redibujo-${fixture.generated}.png`, assetKey: `redibujo-${fixture.generated}.png` };
  },
}));
vi.mock('@/server/ai/model-routing', () => ({
  resolveRoutes: async () => [{ provider: 'kie', model: 'gpt-image-2-5-sunburst-image-to-image', fallbacks: [] }],
}));
// El boceto se lee mal y el redibujado bien: así se ve qué imagen se ha leído.
vi.mock('@/server/plan/import-plan-from-image', async () => {
  const { saveStudio } = await import('@/server/plan/studio-repo');
  return {
    importPlanFromImage: async (ctx: OrgContext, projectId: string, image: StudioImage, _options: unknown, next: StudioState) => {
      fixture.reads.push(image.assetKey ?? '');
      const decision: 'block' | 'proceed' = image.assetKey === 'boceto.png' ? 'block' : 'proceed';
      const quality = { score: decision === 'block' ? 30 : 90, decision, reasons: [] as string[], failOpen: true };
      await saveStudio(ctx, projectId, { ...next, quality,
        planImport: { raw: { muros: [] } as never, detected: null, image } });
      return { imageUrl: image.assetUrl, quality, plano: { zones: [] }, writtenDimensions: [], warnings: [] };
    },
  };
});

import { prisma } from '@/server/db/prisma';
import { loadStudio } from '@/server/plan/studio-repo';
import {
  imageGenerationQuote,
  redrawPlanForReview,
  rereadPlanForReview,
} from '@/app/(app)/projects/[id]/_actions/plan-redraw-actions';
import { importPlanStudio } from '@/app/(app)/projects/[id]/_actions/studio-actions';
import { makeOrg, makeUser, resetDb } from '../helpers/db';

const ROUTE = { provider: 'kie', model: 'gpt-image-2-5-sunburst-image-to-image', maxUsd: 0.15 };

beforeEach(async () => {
  await resetDb();
  fixture.generated = 0;
  fixture.confirmedRoutes.length = 0;
  fixture.reads.length = 0;
  const user = await makeUser();
  fixture.ctx = { organizationId: await makeOrg(), userId: user.id, role: 'owner' };
});

async function project() {
  return prisma.project.create({ data: { organizationId: fixture.ctx!.organizationId, title: 'Asistente' } });
}

describe('redibujado del plano que propone Jev', () => {
  it('presupuesta con el modelo principal de Render 3D', async () => {
    const { id } = await project();
    const quote = await imageGenerationQuote(id);
    if ('actionError' in quote) throw new Error(quote.actionError);
    expect(quote).toMatchObject({ provider: 'kie', model: ROUTE.model, priceUsd: 0.15 });
  });

  it('redibuja solo con la ruta autorizada cuando Jev no da por buena la lectura', async () => {
    const { id } = await project();
    const first = await importPlanStudio(id, 'AAAA');
    if ('actionError' in first) throw new Error(first.actionError);
    expect(first.quality.decision).toBe('block');

    const redrawn = await redrawPlanForReview(id, ROUTE);
    if ('actionError' in redrawn) throw new Error(redrawn.actionError);
    expect(fixture.generated).toBe(1);
    expect(fixture.confirmedRoutes).toEqual([ROUTE]);
    expect(redrawn).toMatchObject({ imageUrl: 'https://cdn/redibujo-1.png', sourceUrl: 'https://cdn/boceto.png' });
    expect(redrawn.quality.decision).toBe('proceed');

    const state = await loadStudio(fixture.ctx!, id);
    expect(state.plan?.assetKey).toBe('redibujo-1.png');
    expect(state.source?.assetKey).toBe('boceto.png');
    expect(state.planImport?.image?.assetKey).toBe('redibujo-1.png');
  });

  it('no gasta si Jev ya da por buena la lectura', async () => {
    const { id } = await project();
    await importPlanStudio(id, 'AAAA');
    await redrawPlanForReview(id, ROUTE);
    const again = await redrawPlanForReview(id, ROUTE);
    expect(again).toHaveProperty('actionError');
    expect(fixture.generated).toBe(1);
  });

  it('vuelve a leer el original o el redibujado sin generar otra imagen', async () => {
    const { id } = await project();
    await importPlanStudio(id, 'AAAA');
    await redrawPlanForReview(id, ROUTE);

    const original = await rereadPlanForReview(id, 'source');
    if ('actionError' in original) throw new Error(original.actionError);
    expect(original.quality.decision).toBe('block');
    const back = await rereadPlanForReview(id, 'tecnico');
    if ('actionError' in back) throw new Error(back.actionError);
    expect(back.quality.decision).toBe('proceed');

    expect(fixture.generated).toBe(1);
    expect(fixture.reads).toEqual(['boceto.png', 'redibujo-1.png', 'boceto.png', 'redibujo-1.png']);
    expect((await loadStudio(fixture.ctx!, id)).redraws?.tecnico?.assetKey).toBe('redibujo-1.png');
  });
});
