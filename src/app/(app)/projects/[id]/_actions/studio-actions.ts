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
import type { StudioQuality } from '@/lib/studio-state';
import {
  importPlanFromImage,
  importNormalizeOptions,
  evaluatePlanQuality,
  type PlanImportStudioResult,
} from '@/server/plan/import-plan-from-image';
import { drawingToPlano } from '@/server/plan/drawing-to-plano';
import { buildPlanImport } from '@/server/plan/build-plan-import';
import { importPlanToEditor } from '@/server/plan/import-plan-to-editor';
import { sanitizeExtractedText } from '@/server/ai/sketch/sanitize-extracted-text';
import { assertPlanoRasterizable } from '@/server/ai/design/cenital-pipeline';
import { runAction, fail } from '@/server/errors/run-action';
import { assertStudioPlanQuality } from '@/server/quality/studio-plan-gate';

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
  qualityAck = false,
) {
  return runAction(() => cenitalStudioImpl(projectId, _url, estilo, detalles, vista, qualityAck));
}

async function cenitalStudioImpl(
  projectId: string,
  _url: string,
  estilo: Estilo,
  detalles = '',
  vista: RenderVista = 'cenital',
  qualityAck = false,
) {
  const { ctx, state } = await context(projectId);
  if (!state.plan) fail('Falta el plano de origen.');
  if (!isValidEstilo(estilo)) fail('Estilo no válido.');
  // Puerta de calidad ANTES de resolver el adaptador de imagen: una vista de
  // pago no parte de un plano por debajo del umbral. El veredicto sale del
  // estado guardado en el servidor, nunca del cliente.
  await assertStudioPlanQuality(ctx, projectId, state, qualityAck === true, 'cenital_estudio');
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
): Promise<PlanImportStudioResult> {
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
): Promise<PlanImportStudioResult> {
  const { ctx, state } = await context(projectId);
  if (!state.plan) fail('Sube o redibuja un plano primero.');
  return importPlanFromImage(ctx, projectId, state.plan, options, state);
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
): Promise<PlanImportResult & { quality: StudioQuality }> {
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
  // La geometría ha cambiado: se reevalúa la fiabilidad (Jev no ve la imagen y
  // cuesta céntimos, así que reevaluar es más barato que decidir con un dato viejo).
  const quality = await evaluatePlanQuality(ctx, projectId, state.planImport.image, {
    raw,
    detected,
    result,
  });
  await saveStudio(ctx, projectId, {
    ...state,
    plano: result.plano,
    escalaEstimada: result.escalaEstimada,
    quality,
  });
  return { ...result, quality };
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
): Promise<{ issues: string[]; needsCorrection: boolean }> {
  const { ctx, state } = await context(projectId);
  assertPlanoRasterizable(result.plano);
  const { issues } = await importPlanToEditor(ctx, projectId, result);
  // Con fiabilidad bajo mínimos el plano SÍ se lleva al editor (es donde el
  // usuario lo arregla), pero queda marcado: nada de pago se genera hasta que
  // lo corrija. El veredicto se lee del estudio, no del cliente.
  return { issues, needsCorrection: state.quality?.decision === 'block' };
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
