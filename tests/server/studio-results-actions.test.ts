import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import type { OrgContext } from '@/server/auth/org-context';

const fixture = vi.hoisted(() => ({
  ctx: null as OrgContext | null,
  files: new Map<string, Buffer>(),
  generated: 0,
}));

vi.mock('server-only', () => ({}));
vi.mock('@/server/auth/require-org-context', () => ({
  requireOrgContext: async () => fixture.ctx,
}));
vi.mock('@/server/privacy/consent-service', () => ({ assertConsent: async () => {} }));
vi.mock('@/server/legal/tos-acceptance-service', () => ({ assertTosAccepted: async () => {} }));
vi.mock('@/server/storage/s3-storage-adapter', () => ({
  getStorageAdapter: () => ({
    put: async ({ key, body }: { key: string; body: Buffer }) => {
      fixture.files.set(key, body);
    },
    get: async (key: string) => {
      const data = fixture.files.get(key);
      if (!data) throw new Error('Activo no encontrado');
      return data;
    },
    getPresignedDownloadUrl: async (key: string) => `https://storage.local/${key}?signed=temporal`,
  }),
}));
vi.mock('@/server/ai', () => ({
  getImageAdapterForAction: async () => ({
    generate: async () => {
      fixture.generated += 1;
      return {
        assetKey: `renders/fake-${fixture.generated}.png`,
        assetUrl: `https://storage.local/renders/fake-${fixture.generated}.png?signed=temporal`,
      };
    },
  }),
}));

import { prisma } from '@/server/db/prisma';
import { loadStudio, saveStudio } from '@/server/plan/studio-repo';
import { buildPlanImport } from '@/server/plan/build-plan-import';
import {
  redrawStudio,
  drawingStudio,
  selectStudioResult,
  startNewStudioPlan,
  uploadStudio,
  applyPlanImportStudio,
} from '@/app/(app)/projects/[id]/_actions/studio-actions';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { makeOrg, makeUser, resetDb } from '../helpers/db';

beforeEach(async () => {
  await resetDb();
  fixture.files.clear();
  fixture.generated = 0;
  const user = await makeUser();
  fixture.ctx = { organizationId: await makeOrg(), userId: user.id, role: 'owner' };
});

describe('historial de acciones del estudio', () => {
  it('guarda el boceto como importación revisable y lo recupera sin visión IA', async () => {
    const ctx = fixture.ctx!;
    const project = await prisma.project.create({
      data: { organizationId: ctx.organizationId, title: 'Boceto' },
    });
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="white"/><path d="M140 120H700V450H140Z" fill="none" stroke="black" stroke-width="7"/></svg>';
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const drawn = await drawingStudio(project.id, png.toString('base64'));
    if ('actionError' in drawn) throw new Error(drawn.actionError);

    expect(drawn.importResult.escalaEstimada).toBe(true);
    expect(drawn.importResult.quality.decision).toBe('confirm');
    const reloaded = await loadStudio(ctx, project.id);
    expect(reloaded.sourceKind).toBe('drawing');
    expect(reloaded.planImport?.raw.escalaFiable).toBe(false);
    expect(reloaded.planImport?.detected?.walls).toHaveLength(4);
    expect(reloaded.planImportApplied).toBe(false);
    expect(reloaded.quality?.reasons[0]).toContain('ancho real');
    const saved = reloaded.planImport!;
    expect(buildPlanImport(saved.raw, {
      includeFurniture: saved.includeFurniture,
      normalize: {
        wallsOverride: saved.detected!.walls,
        imageHeightOverWidth: saved.detected!.heightOverWidth,
      },
    }).plano).toEqual(drawn.importResult.plano);
  });

  it('rechaza una importación alterada por el cliente y aplica la revisión guardada', async () => {
    const ctx = fixture.ctx!;
    const project = await prisma.project.create({
      data: { organizationId: ctx.organizationId, title: 'Aplicar boceto' },
    });
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="white"/><path d="M140 120H700V450H140Z" fill="none" stroke="black" stroke-width="7"/></svg>';
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const drawn = await drawingStudio(project.id, png.toString('base64'));
    if ('actionError' in drawn) throw new Error(drawn.actionError);

    const tampered = await applyPlanImportStudio(project.id, {
      ...drawn.importResult,
      escalaEstimada: false,
    });
    expect(tampered).toHaveProperty('actionError', expect.stringMatching(/cambió/));
    expect((await withEditorDocuments(ctx).load({ projectId: project.id })).authority).toBe('legacy');

    const accepted = await applyPlanImportStudio(
      project.id,
      JSON.parse(JSON.stringify(drawn.importResult)),
    );
    if ('actionError' in accepted) throw new Error(accepted.actionError);
    expect(accepted.needsCorrection).toBe(true);
    const editor = await withEditorDocuments(ctx).load({ projectId: project.id });
    if (editor.authority !== 'v2') throw new Error('Se esperaba Editor v2');
    expect(editor.document.walls.length).toBeGreaterThanOrEqual(4);
    expect(editor.document.walls.some((wall) => wall.dimensionalOrigin === 'raster')).toBe(true);
  });

  it('aplica la extracción revisada aunque el vector guardado sea de una versión anterior', async () => {
    const ctx = fixture.ctx!;
    const project = await prisma.project.create({
      data: { organizationId: ctx.organizationId, title: 'Extracción anterior' },
    });
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="white"/><path d="M140 120H700V450H140Z" fill="none" stroke="black" stroke-width="7"/></svg>';
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const drawn = await drawingStudio(project.id, png.toString('base64'));
    if ('actionError' in drawn) throw new Error(drawn.actionError);
    const saved = await loadStudio(ctx, project.id);
    await saveStudio(ctx, project.id, { ...saved, plano: { schemaVersion: 1, zones: [] } });

    const applied = await applyPlanImportStudio(project.id, JSON.parse(JSON.stringify(drawn.importResult)));
    if ('actionError' in applied) throw new Error(applied.actionError);
    expect((await loadStudio(ctx, project.id)).plano).toEqual(drawn.importResult.plano);
    expect((await withEditorDocuments(ctx).load({ projectId: project.id })).authority).toBe('v2');
  });

  it('conserva originales y generaciones tras recargar y cambiar el plano activo', async () => {
    const ctx = fixture.ctx!;
    const project = await prisma.project.create({
      data: { organizationId: ctx.organizationId, title: 'Historia' },
    });
    const png = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#ffffff' } })
      .png()
      .toBuffer();
    const uploaded = await uploadStudio(project.id, png.toString('base64'));
    if ('actionError' in uploaded) throw new Error(uploaded.actionError);
    const first = await redrawStudio(project.id, [], 'tecnico');
    if ('actionError' in first) throw new Error(first.actionError);
    const second = await redrawStudio(project.id, [], 'tecnico');
    if ('actionError' in second) throw new Error(second.actionError);

    const reloaded = await loadStudio(ctx, project.id);
    expect(reloaded.results?.map((item) => item.kind)).toEqual(['source', 'redraw', 'redraw']);
    expect(reloaded.results?.[2]?.sourceKey).toBe(uploaded.assetKey);
    expect(JSON.stringify(reloaded.results)).not.toContain('signed=temporal');

    const cleared = await startNewStudioPlan(project.id);
    if ('actionError' in cleared) throw new Error(cleared.actionError);
    expect((await loadStudio(ctx, project.id)).plan).toBeUndefined();
    const selected = await selectStudioResult(project.id, first.assetKey!);
    if ('actionError' in selected) throw new Error(selected.actionError);
    expect((await loadStudio(ctx, project.id)).plan?.assetKey).toBe(first.assetKey);
  });
});
