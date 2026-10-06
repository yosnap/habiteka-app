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
  refitPlanImportStudio,
  importCanvasStudio,
  importStudioPlanStudio,
  setEditorBackgroundStudio,
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
  it('guarda la revisión manual, la recupera y aplica su ancho al Editor sin generar imágenes', async () => {
    const ctx = fixture.ctx!;
    const project = await prisma.project.create({ data: { organizationId: ctx.organizationId, title: 'Revisión aislada' } });
    const raw = { anchoMetros: 4, altoMetros: 3, escalaFiable: true,
      muros: [{ x1: 0, y1: 0, x2: 1, y2: 0 }, { x1: 1, y1: 0, x2: 1, y2: 1 },
        { x1: 1, y1: 1, x2: 0, y2: 1 }, { x1: 0, y1: 1, x2: 0, y2: 0 }],
      habitaciones: [{ nombre: 'Sala', poligono: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] }],
      aberturas: [{ tipo: 'puerta' as const, muro: 0, posicion: .5, anchoSobreMuro: .2 }], mobiliario: [] };
    const initial = buildPlanImport(raw), door = initial.plano.zones.flatMap(zone => zone.apertures)[0]!;
    await saveStudio(ctx, project.id, { planImport: { raw, detected: null, image: { assetUrl: 'data:image/png;base64,YQ==' } },
      planImportRevision: 'inicial', quality: { score: 20, decision: 'block', reasons: ['Pendiente'], failOpen: false } });
    const saved = await refitPlanImportStudio(project.id, initial.writtenDimensions, {
      revision: 'inicial', saveOnly: true, doorOverrides: [{ apertureId: door.id, widthMm: 1000 }] });
    if ('actionError' in saved) throw new Error(saved.actionError);
    expect(saved.quality).toMatchObject({ score: null, decision: 'block', failOpen: false });
    const savedAgain = await refitPlanImportStudio(project.id, saved.writtenDimensions, { revision: saved.revision, saveOnly: true });
    if ('actionError' in savedAgain) throw new Error(savedAgain.actionError);
    expect(savedAgain.quality.reasons).toEqual(saved.quality.reasons);
    expect(new Set(savedAgain.quality.reasons).size).toBe(savedAgain.quality.reasons.length);
    const reloaded = await loadStudio(ctx, project.id);
    expect(reloaded.planImport?.doorOverrides?.[0]?.widthMm).toBe(1000);
    expect(buildPlanImport(raw, { doorOverrides: reloaded.planImport?.doorOverrides }).plano).toEqual(saved.plano);
    const stale = await refitPlanImportStudio(project.id, [], { revision: 'inicial', saveOnly: true });
    expect(stale).toHaveProperty('actionError');
    const applied = await applyPlanImportStudio(project.id, saved);
    if ('actionError' in applied) throw new Error(applied.actionError);
    const editor = await withEditorDocuments(ctx).load({ projectId: project.id });
    if (editor.authority !== 'v2') throw new Error('Falta Editor v2');
    expect(editor.document.openings.some(opening => opening.widthMm === 1000)).toBe(true);
    expect((await loadStudio(ctx, project.id)).planImportApplied).toBe(true);
    expect(fixture.generated).toBe(0);
  });
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

  it('el fondo del editor se fija al enviarlo, no lo cambia una captura del editor y se puede elegir otra imagen', async () => {
    const ctx = fixture.ctx!;
    const project = await prisma.project.create({ data: { organizationId: ctx.organizationId, title: 'Fondo del editor' } });
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="white"/><path d="M140 120H700V450H140Z M380 120V450" fill="none" stroke="black" stroke-width="7"/></svg>';
    const drawn = await drawingStudio(project.id, (await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64'));
    if ('actionError' in drawn) throw new Error(drawn.actionError);
    const applied = await applyPlanImportStudio(project.id, drawn.importResult);
    if ('actionError' in applied) throw new Error(applied.actionError);
    const sent = await loadStudio(ctx, project.id);
    expect(sent.editorReference?.image.assetKey).toBe(drawn.assetKey);
    expect(sent.editorReference?.frame.width).toBeGreaterThan(0);

    // «Traer el plano del editor»: la captura es el plano de trabajo, pero no sustituye el original ni el fondo.
    const capture = await importCanvasStudio(project.id);
    if ('actionError' in capture) throw new Error(capture.actionError);
    const captured = await loadStudio(ctx, project.id);
    expect(captured.source?.assetKey).toBe(drawn.assetKey);
    expect(captured.plan?.assetKey).toBe(capture.assetKey);
    expect(captured.results?.find((item) => item.assetKey === capture.assetKey)?.kind).toBe('canvas');
    expect(captured.editorReference).toEqual(sent.editorReference);
    expect(captured.planImport?.image?.assetKey).toBe(drawn.assetKey);
    // Extraerla solo perdería información, y no vale como fondo.
    expect(await importStudioPlanStudio(project.id)).toHaveProperty('actionError', expect.stringMatching(/captura del editor/));
    expect(await setEditorBackgroundStudio(project.id, capture.assetKey!)).toHaveProperty('actionError', expect.stringMatching(/boceto original o un redibujado/));

    // El boceto elegido como fondo se alinea con los muros del plano del editor.
    const chosen = await setEditorBackgroundStudio(project.id, drawn.assetKey!);
    if ('actionError' in chosen) throw new Error(chosen.actionError);
    const background = (await loadStudio(ctx, project.id)).editorReference!;
    expect(background.image.assetKey).toBe(drawn.assetKey);
    // El plano sale de esta misma imagen: el fondo conserva su proporción (900 × 600) sin deformarse.
    expect(background.frame.width / background.frame.height).toBeCloseTo(1.5, 1);
    expect(fixture.generated).toBe(0);
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
