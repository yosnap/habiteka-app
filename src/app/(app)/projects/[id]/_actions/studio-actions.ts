'use server';

import { requireOrgContext } from '@/server/auth/require-org-context';
import { assertConsent } from '@/server/privacy/consent-service';
import { assertTosAccepted } from '@/server/legal/tos-acceptance-service';
import { loadStudio, saveStudio } from '@/server/plan/studio-repo';
import { persistStudioSource, readStudioImage } from '@/server/plan/studio-image';
import { getImageAdapterForAction } from '@/server/ai';
import { redrawPlan, type RedrawMode } from '@/server/ai/design/redraw-plan-pipeline';
import { generateCenitalFromImage } from '@/server/ai/design/cenital-pipeline';
import type { RenderVista } from '@/server/ai/design/room-prompt-builder';
import { isValidEstilo } from '@/lib/design-options';
import { withOrg } from '@/server/db/scoped-repo';
import { deserializeCanvas } from '@/canvas/serialize';
import { rasterizeCanvasDoc } from '@/server/agent/canvas/rasterize-canvas-doc';
import { rasterizeEditorDocument } from '@/server/agent/editor-v2/rasterize-editor-document';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { serializeDocToPrompt } from '@/canvas/serialize-doc-to-prompt';
import type { Estilo, PlanImportResult, WrittenRoomDimensions } from '@/lib/contracts';
import type { OrgContext } from '@/server/auth/org-context';
import type { StudioImage, StudioState } from '@/lib/studio-state';
import type { DetectedWalls } from '@/server/plan/detect-walls-raster';
import { drawingToPlano } from '@/server/plan/drawing-to-plano';
import { getChatVisionAdapter } from '@/server/ai';
import { extractPlanSource } from '@/server/plan/extract-plan-source';
import { buildPlanImport } from '@/server/plan/build-plan-import';
import { importPlanToEditor } from '@/server/plan/import-plan-to-editor';
import { sanitizeExtractedText } from '@/server/ai/sketch/sanitize-extracted-text';
import { assertPlanoRasterizable } from '@/server/ai/design/cenital-pipeline';
import { runAction, fail } from '@/server/errors/run-action';

async function context(projectId: string) {
  const ctx = await requireOrgContext();
  const state = await loadStudio(ctx, projectId);
  await assertConsent(ctx.userId, 'IMAGE_PROCESSING');
  await assertTosAccepted(ctx.userId);
  return { ctx, state };
}

export async function redrawStudio(
  projectId: string,
  parts: Array<{ base64: string }>,
  mode: RedrawMode = 'tecnico',
) {
  return runAction(() => redrawStudioImpl(projectId, parts, mode));
}

async function redrawStudioImpl(
  projectId: string,
  parts: Array<{ base64: string }>,
  mode: RedrawMode = 'tecnico',
) {
  const { ctx, state } = await context(projectId);
  const source = parts[0] ? await persistStudioSource(parts[0].base64) : state.source;
  if (!source) fail('Sube o dibuja un plano primero.');
  const redrawMode: RedrawMode = mode === 'decorado' ? 'decorado' : 'tecnico';
  const image = await getImageAdapterForAction({ organizationId: ctx.organizationId }, 'render3d');
  const result = await redrawPlan({ image }, await readStudioImage(source), redrawMode);
  // Se conserva el redibujado del otro modo: el usuario alterna entre ambos.
  const redraws = { ...state.redraws, [redrawMode]: result };
  await saveStudio(ctx, projectId, { ...state, source, plan: result, redrawMode, redraws });
  return { imageUrl: result.assetUrl, assetKey: result.assetKey };
}

/**
 * Activa el redibujado ya generado de un modo (técnico o decorado) como plano
 * de trabajo: es la imagen de la que se extrae geometría y se genera la vista.
 */
export async function selectRedrawStudio(projectId: string, mode: RedrawMode) {
  return runAction(() => selectRedrawStudioImpl(projectId, mode));
}

async function selectRedrawStudioImpl(projectId: string, mode: RedrawMode) {
  const { ctx, state } = await context(projectId);
  const redrawMode: RedrawMode = mode === 'decorado' ? 'decorado' : 'tecnico';
  const plan = state.redraws?.[redrawMode];
  if (!plan) fail('Ese redibujado aún no se ha generado.');
  await saveStudio(ctx, projectId, { ...state, plan, redrawMode, plano: undefined, cenital: undefined });
  return { imageUrl: plan.assetUrl, assetKey: plan.assetKey };
}

/** Primero conservar el original; redibujar con IA es una acción explícita. */
export async function uploadStudio(projectId: string, base64: string) {
  return runAction(() => uploadStudioImpl(projectId, base64));
}

async function uploadStudioImpl(projectId: string, base64: string) {
  const { ctx } = await context(projectId);
  const source = await persistStudioSource(base64);
  await saveStudio(ctx, projectId, { source, plan: source, sourceKind: 'upload' });
  return { imageUrl: source.assetUrl };
}

export async function drawingStudio(projectId: string, base64: string) {
  return runAction(() => drawingStudioImpl(projectId, base64));
}

async function drawingStudioImpl(projectId: string, base64: string) {
  const { ctx } = await context(projectId);
  const source = await persistStudioSource(base64);
  const sanitized = await readStudioImage(source);
  const result = await drawingToPlano(Buffer.from(sanitized.base64, 'base64'));
  await saveStudio(ctx, projectId, { source, plan: source, sourceKind: 'drawing', ...result });
  return { imageUrl: source.assetUrl, ...result };
}


export async function cenitalStudio(
  projectId: string,
  _url: string,
  estilo: Estilo,
  detalles = '',
  vista: RenderVista = 'cenital',
) {
  return runAction(() => cenitalStudioImpl(projectId, _url, estilo, detalles, vista));
}

async function cenitalStudioImpl(
  projectId: string,
  _url: string,
  estilo: Estilo,
  detalles = '',
  vista: RenderVista = 'cenital',
) {
  const { ctx, state } = await context(projectId);
  if (!state.plan) fail('Falta el plano de origen.');
  if (!isValidEstilo(estilo)) fail('Estilo no válido.');
  const renderVista: RenderVista = vista === 'maqueta' ? 'maqueta' : 'cenital';
  const image = await getImageAdapterForAction({ organizationId: ctx.organizationId }, 'render3d');
  const notes = String(detalles).slice(0, 800);
  // El ORIGINAL manda (trae el mobiliario y los sanitarios que un redibujado
  // técnico elimina); el redibujado, si existe y es distinto, acompaña como
  // referencia de geometría limpia.
  const original = state.source ?? state.plan;
  const hasRedraw = state.plan.assetKey !== undefined && state.plan.assetKey !== original.assetKey;
  const result = await generateCenitalFromImage(
    { image },
    await readStudioImage(original),
    estilo,
    notes,
    state.canvasDescription,
    {
      vista: renderVista,
      ...(hasRedraw ? { structuralReference: await readStudioImage(state.plan) } : {}),
    },
  );
  await saveStudio(ctx, projectId, { ...state, cenital: result, estilo, detalles: notes, vista: renderVista });
  return { imageUrl: result.assetUrl };
}

/** El canvas amueblado viaja directamente como referencia, sin eliminar muebles. */
export async function importCanvasStudio(projectId: string) {
  return runAction(() => importCanvasStudioImpl(projectId));
}

async function importCanvasStudioImpl(projectId: string) {
  const { ctx } = await context(projectId);
  const editor = await withEditorDocuments(ctx).load({ projectId });
  let base64: string;
  let canvasDescription: string | undefined;
  if (editor.authority === 'v2') {
    // Proyecto en el editor v2: se rasteriza el documento (planta cenital).
    if (editor.document.walls.length === 0)
      fail('Dibuja los muros y guarda el editor antes de traer el plano.');
    base64 = (await rasterizeEditorDocument(editor.document)).base64;
  } else {
    const doc = deserializeCanvas(await withOrg(ctx).canvas.load(projectId));
    if (!doc.objects.some((o) => o.kind === 'wall'))
      fail('Dibuja los muros y guarda el editor antes de traer el plano.');
    base64 = (await rasterizeCanvasDoc(doc)).base64;
    canvasDescription = serializeDocToPrompt(doc) ?? undefined;
  }
  const source = await persistStudioSource(base64);
  await saveStudio(ctx, projectId, { source, plan: source, sourceKind: 'canvas', canvasDescription });
  return { imageUrl: source.assetUrl };
}

// ── Importar plano dibujado o creado (F1 plano importado) ─────────────────────

/**
 * Extrae un PLANO DIBUJADO (esquemático, CAD, PDF rasterizado en cliente) y
 * devuelve la importación completa: plano ajustado a cotas, tabla de medidas
 * escritas, zonas exteriores, mobiliario y avisos. No toca el editor: el
 * usuario revisa la tabla y confirma con `applyPlanImportStudio`.
 */
export async function importPlanStudio(
  projectId: string,
  base64: string,
  options: { includeFurniture?: boolean } = {},
) {
  return runAction(() => importPlanStudioImpl(projectId, base64, options));
}

async function importPlanStudioImpl(
  projectId: string,
  base64: string,
  options: { includeFurniture?: boolean } = {},
): Promise<PlanImportResult & { imageUrl: string }> {
  const { ctx, state } = await context(projectId);
  const source = await persistStudioSource(base64);
  // Los redibujados del estudio se conservan: importar un fichero no debe borrar trabajo.
  return importPlanFromImage(ctx, projectId, source, options, { ...state, source, plan: source, sourceKind: 'upload' });
}

/**
 * Importa la imagen ACTIVA del estudio (el redibujado técnico o decorado, o el
 * original subido) sin descargarla ni volverla a subir. Conserva la fuente y
 * los redibujados: sólo cambia la extracción guardada.
 */
export async function importStudioPlanStudio(
  projectId: string,
  options: { includeFurniture?: boolean } = {},
) {
  return runAction(() => importStudioPlanStudioImpl(projectId, options));
}

async function importStudioPlanStudioImpl(
  projectId: string,
  options: { includeFurniture?: boolean } = {},
): Promise<PlanImportResult & { imageUrl: string }> {
  const { ctx, state } = await context(projectId);
  if (!state.plan) fail('Sube o redibuja un plano primero.');
  return importPlanFromImage(ctx, projectId, state.plan, options, state);
}

/** Extracción (visión + raster) → importación; guarda la extracción cruda para recalcular sin IA. */
async function importPlanFromImage(
  ctx: OrgContext,
  projectId: string,
  imageRef: StudioImage,
  options: { includeFurniture?: boolean },
  nextState: StudioState,
): Promise<PlanImportResult & { imageUrl: string }> {
  const image = await readStudioImage(imageRef);
  const chat = await getChatVisionAdapter({ organizationId: ctx.organizationId }, 'vision');
  const { raw, detected } = await extractPlanSource(
    chat,
    [{ type: 'image_url', base64: image.base64, mimeType: image.mimeType }],
    'plano',
  );
  const result = buildPlanImport(raw, {
    includeFurniture: options.includeFurniture !== false,
    normalize: importNormalizeOptions(detected),
  });
  await saveStudio(ctx, projectId, {
    ...nextState,
    plano: result.plano,
    escalaEstimada: result.escalaEstimada,
    planImport: { raw, detected, image: imageRef },
  });
  return { ...result, imageUrl: imageRef.assetUrl };
}

function importNormalizeOptions(detected: DetectedWalls | null) {
  return detected ? { wallsOverride: detected.walls, imageHeightOverWidth: detected.heightOverWidth } : {};
}

/**
 * Recalcula la importación con las medidas corregidas en la tabla (sin volver
 * a llamar a la IA: la extracción cruda quedó guardada en el estudio).
 */
export async function refitPlanImportStudio(
  projectId: string,
  roomOverrides: WrittenRoomDimensions[],
  options: { includeFurniture?: boolean; generalWidthMm?: number } = {},
) {
  return runAction(() => refitPlanImportStudioImpl(projectId, roomOverrides, options));
}

async function refitPlanImportStudioImpl(
  projectId: string,
  roomOverrides: WrittenRoomDimensions[],
  options: { includeFurniture?: boolean; generalWidthMm?: number } = {},
): Promise<PlanImportResult> {
  const { ctx, state } = await context(projectId);
  if (!state.planImport) fail('Importa un plano primero.');
  const { raw, detected } = state.planImport;
  const width = options.generalWidthMm;
  const generalWidthMm =
    typeof width === 'number' && Number.isFinite(width) && width >= 1000 && width <= 100000 ? Math.round(width) : undefined;
  const result = buildPlanImport(raw, {
    roomOverrides: sanitizeOverrides(roomOverrides),
    includeFurniture: options.includeFurniture !== false,
    ...(generalWidthMm !== undefined ? { generalWidthMm } : {}),
    normalize: importNormalizeOptions(detected),
  });
  await saveStudio(ctx, projectId, { ...state, plano: result.plano, escalaEstimada: result.escalaEstimada });
  return result;
}

/**
 * Materializa la importación como documento del Editor v2 (autoridad editor).
 * REEMPLAZA el plano del proyecto: la UI pide confirmación antes de llamar.
 */
export async function applyPlanImportStudio(
  projectId: string,
  result: PlanImportResult,
) {
  return runAction(() => applyPlanImportStudioImpl(projectId, result));
}

async function applyPlanImportStudioImpl(
  projectId: string,
  result: PlanImportResult,
): Promise<{ issues: string[] }> {
  const { ctx } = await context(projectId);
  assertPlanoRasterizable(result.plano);
  const { issues } = await importPlanToEditor(ctx, projectId, result);
  return { issues };
}

/** Solo números plausibles y nombres saneados entran en el solver desde la tabla. */
function sanitizeOverrides(rows: WrittenRoomDimensions[]): WrittenRoomDimensions[] {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 60).map((row) => {
    const mm = (v: unknown) =>
      typeof v === 'number' && Number.isFinite(v) && v >= 500 && v <= 30000 ? Math.round(v) : undefined;
    const width = mm(row.widthMm);
    const height = mm(row.heightMm);
    return {
      zoneId: String(row.zoneId).slice(0, 64),
      name: sanitizeExtractedText(row.name) || 'Estancia',
      ...(width !== undefined ? { widthMm: width } : {}),
      ...(height !== undefined ? { heightMm: height } : {}),
      ...(row.exterior === true ? { exterior: true } : {}),
    };
  });
}
