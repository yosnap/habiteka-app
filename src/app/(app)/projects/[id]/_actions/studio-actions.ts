'use server';

import { requireOrgContext } from '@/server/auth/require-org-context';
import { assertConsent } from '@/server/privacy/consent-service';
import { assertTosAccepted } from '@/server/legal/tos-acceptance-service';
import { loadStudio, saveStudio } from '@/server/plan/studio-repo';
import { persistStudioSource, readStudioImage } from '@/server/plan/studio-image';
import { getImageAdapterForAction } from '@/server/ai';
import { redrawPlan } from '@/server/ai/design/redraw-plan-pipeline';
import { generateCenitalFromImage } from '@/server/ai/design/cenital-pipeline';
import { extractPlanFromSketch } from './agent-actions';
import { isValidEstilo } from '@/lib/design-options';
import { withOrg } from '@/server/db/scoped-repo';
import { deserializeCanvas } from '@/canvas/serialize';
import { rasterizeCanvasDoc } from '@/server/agent/canvas/rasterize-canvas-doc';
import { rescalePlanoToWidth } from '@/lib/plan-svg/rescale-plano';
import { serializeDocToPrompt } from '@/canvas/serialize-doc-to-prompt';
import type { Estilo } from '@/lib/contracts';
import { drawingToPlano } from '@/server/plan/drawing-to-plano';

async function context(projectId: string) {
  const ctx = await requireOrgContext();
  const state = await loadStudio(ctx, projectId);
  await assertConsent(ctx.userId, 'IMAGE_PROCESSING');
  await assertTosAccepted(ctx.userId);
  return { ctx, state };
}

export async function redrawStudio(projectId: string, parts: Array<{ base64: string }>) {
  const { ctx, state } = await context(projectId);
  const source = parts[0] ? await persistStudioSource(parts[0].base64) : state.source;
  if (!source) throw new Error('Sube o dibuja un plano primero.');
  const image = await getImageAdapterForAction({ organizationId: ctx.organizationId }, 'render3d');
  const result = await redrawPlan({ image }, await readStudioImage(source));
  await saveStudio(ctx, projectId, { source, plan: result });
  return { imageUrl: result.assetUrl };
}

/** Primero conservar el original; redibujar con IA es una acción explícita. */
export async function uploadStudio(projectId: string, base64: string) {
  const { ctx } = await context(projectId);
  const source = await persistStudioSource(base64);
  await saveStudio(ctx, projectId, { source, plan: source, sourceKind: 'upload' });
  return { imageUrl: source.assetUrl };
}

export async function drawingStudio(projectId: string, base64: string) {
  const { ctx } = await context(projectId);
  const source = await persistStudioSource(base64);
  const sanitized = await readStudioImage(source);
  const result = await drawingToPlano(Buffer.from(sanitized.base64, 'base64'));
  await saveStudio(ctx, projectId, { source, plan: source, sourceKind: 'drawing', ...result });
  return { imageUrl: source.assetUrl, ...result };
}

export async function extractStudio(projectId: string) {
  const { ctx, state } = await context(projectId);
  if (!state.plan) throw new Error('Falta el plano de origen.');
  const source = await readStudioImage(state.plan);
  const result = await extractPlanFromSketch(projectId, [{ type: 'image_url', ...source }]);
  await saveStudio(ctx, projectId, { ...state, ...result });
  return result;
}

export async function cenitalStudio(
  projectId: string,
  _url: string,
  estilo: Estilo,
  detalles = '',
) {
  const { ctx, state } = await context(projectId);
  if (!state.plan) throw new Error('Falta el plano de origen.');
  if (!isValidEstilo(estilo)) throw new Error('Estilo no válido.');
  const image = await getImageAdapterForAction({ organizationId: ctx.organizationId }, 'render3d');
  const notes = String(detalles).slice(0, 800);
  const result = await generateCenitalFromImage(
    { image },
    await readStudioImage(state.plan),
    estilo,
    notes,
    state.canvasDescription,
  );
  await saveStudio(ctx, projectId, { ...state, cenital: result, estilo, detalles: notes });
  return { imageUrl: result.assetUrl };
}

/** El canvas amueblado viaja directamente como referencia, sin eliminar muebles. */
export async function importCanvasStudio(projectId: string) {
  const { ctx } = await context(projectId);
  const doc = deserializeCanvas(await withOrg(ctx).canvas.load(projectId));
  if (!doc.objects.some((o) => o.kind === 'wall'))
    throw new Error('Dibuja los muros y guarda el editor antes de importar.');
  const raster = await rasterizeCanvasDoc(doc);
  const source = await persistStudioSource(raster.base64);
  await saveStudio(ctx, projectId, {
    source,
    plan: source,
    canvasDescription: serializeDocToPrompt(doc) ?? undefined,
  });
  return { imageUrl: source.assetUrl };
}

export async function scaleStudio(projectId: string, meters: number) {
  const { ctx, state } = await context(projectId);
  if (!state.plano) throw new Error('Extrae la geometría primero.');
  if (!Number.isFinite(meters) || meters < 1 || meters > 100)
    throw new Error('Indica un ancho entre 1 y 100 metros.');
  const plano = rescalePlanoToWidth(state.plano, meters);
  await saveStudio(ctx, projectId, { ...state, plano, escalaEstimada: false });
  return plano;
}
