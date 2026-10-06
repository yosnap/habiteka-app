'use server';

import { isDeepStrictEqual } from 'node:util';
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
import type { Estilo, PlanDoorOverride, PlanWallOverride, PlanImportReviewOptions, PlanImportResult, WrittenRoomDimensions } from '@/lib/contracts';
import type { EditorBackground, StudioQuality, StudioState } from '@/lib/studio-state';
import { fitBackgroundFrame } from '@/server/plan/editor-background';
import {
  importPlanFromImage,
  importNormalizeOptions,
  evaluatePlanQuality,
  type PlanImportStudioResult,
} from '@/server/plan/import-plan-from-image';
import { drawingToPlanImport } from '@/server/plan/drawing-to-plano';
import { buildPlanImport } from '@/server/plan/build-plan-import';
import { blockingPlanImportWarning } from '@/lib/plan-quality';
import { importPlanToEditor } from '@/server/plan/import-plan-to-editor';
import { sanitizeExtractedText } from '@/server/ai/sketch/sanitize-extracted-text';
import { assertPlanoRasterizable } from '@/server/ai/design/cenital-pipeline';
import { runAction, fail } from '@/server/errors/run-action';
import { assertStudioPlanQuality } from '@/server/quality/studio-plan-gate';
import { appendStudioResult, studioResults } from '@/lib/studio-results';
import { resolveRenderUrl } from '@/server/storage/render-urls';

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
  const baseline = source.assetKey !== state.source?.assetKey
    ? { ...state, results: appendStudioResult(state, source, { kind: 'source' }) }
    : state;
  const redrawMode: RedrawMode = mode === 'decorado' ? 'decorado' : 'tecnico';
  const image = await getImageAdapterForAction({ organizationId: ctx.organizationId }, 'render3d');
  const result = await redrawPlan({ image }, await readStudioImage(source), redrawMode);
  // Se conserva el redibujado del otro modo: el usuario alterna entre ambos.
  const redraws = { ...baseline.redraws, [redrawMode]: result };
  // Otra imagen de trabajo: el veredicto y la extracción del plano anterior ya no valen.
  const results = appendStudioResult(baseline, result, {
    kind: 'redraw', mode: redrawMode, ...(source.assetKey ? { sourceKey: source.assetKey } : {}),
  });
  await saveStudio(ctx, projectId, {
    ...baseline, source, plan: result, redrawMode, redraws, results,
    sourceKind: 'upload', plano: undefined, escalaEstimada: undefined,
    cenital: undefined, quality: undefined, planImport: undefined,
    planImportApplied: false, planImportRevision: undefined,
  });
  return { imageUrl: result.assetUrl, assetKey: result.assetKey, studioResult: results.find((item) => item.assetKey === result.assetKey) };
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
  await saveStudio(ctx, projectId, {
    ...state, plan, redrawMode, plano: undefined, cenital: undefined,
    quality: undefined, planImport: undefined, planImportApplied: false,
    planImportRevision: undefined,
  });
  return { imageUrl: plan.assetUrl, assetKey: plan.assetKey };
}

/** Primero conservar el original; redibujar con IA es una acción explícita. */
export async function uploadStudio(projectId: string, base64: string) {
  return runAction(() => uploadStudioImpl(projectId, base64));
}

async function uploadStudioImpl(projectId: string, base64: string) {
  const { ctx, state } = await context(projectId);
  const source = await persistStudioSource(base64);
  const results = appendStudioResult(state, source, { kind: 'source' });
  await saveStudio(ctx, projectId, {
    source, plan: source, sourceKind: 'upload', results,
    estilo: state.estilo, detalles: state.detalles, editorReference: state.editorReference,
  });
  return { imageUrl: source.assetUrl, assetKey: source.assetKey, studioResult: results.find((item) => item.assetKey === source.assetKey) };
}

export async function drawingStudio(projectId: string, base64: string) {
  return runAction(() => drawingStudioImpl(projectId, base64));
}

async function drawingStudioImpl(projectId: string, base64: string) {
  const { ctx, state } = await context(projectId);
  const source = await persistStudioSource(base64);
  const sanitized = await readStudioImage(source);
  const { raw, detected, result } = await drawingToPlanImport(Buffer.from(sanitized.base64, 'base64'));
  // El boceto no contiene cotas reales: se revisa sin atribuirle una puntuación de Jev.
  const quality: StudioQuality = {
    score: null,
    decision: 'confirm',
    reasons: ['El boceto no tiene escala confirmada. Revisa los muros e indica el ancho real antes de diseñar.'],
    failOpen: false,
  };
  const results = appendStudioResult(state, source, { kind: 'source' });
  await saveStudio(ctx, projectId, {
    source, plan: source, sourceKind: 'drawing', results,
    estilo: state.estilo, detalles: state.detalles, editorReference: state.editorReference,
    plano: result.plano, escalaEstimada: result.escalaEstimada,
    planImport: { raw, detected, image: source, includeFurniture: false },
    planImportApplied: false, planImportRevision: crypto.randomUUID(), quality,
  });
  return {
    imageUrl: source.assetUrl, assetKey: source.assetKey,
    studioResult: results.find((item) => item.assetKey === source.assetKey),
    importResult: { ...result, imageUrl: source.assetUrl, quality },
    plano: result.plano, escalaEstimada: result.escalaEstimada,
  };
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
  const results = appendStudioResult(state, result, {
    kind: 'render', vista: renderVista, estilo,
    ...(original.assetKey ? { sourceKey: original.assetKey } : {}),
  });
  await saveStudio(ctx, projectId, { ...state, cenital: result, estilo, detalles: notes, vista: renderVista, results });
  return { imageUrl: result.assetUrl, assetKey: result.assetKey, studioResult: results.find((item) => item.assetKey === result.assetKey) };
}

/** El canvas amueblado viaja directamente como referencia, sin eliminar muebles. */
export async function importCanvasStudio(projectId: string) {
  return runAction(() => importCanvasStudioImpl(projectId));
}

async function importCanvasStudioImpl(projectId: string) {
  const { ctx, state } = await context(projectId);
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
  const capture = await persistStudioSource(base64);
  const results = appendStudioResult(state, capture, { kind: 'canvas' });
  // La captura es solo el plano de trabajo para generar vistas: el original (boceto o imagen subida), la extracción y
  // el fondo del editor siguen siendo los de antes. Sin original previo, la captura hace también de origen.
  const original = state.sourceKind !== 'canvas' && state.source ? state.source : capture;
  await saveStudio(ctx, projectId, {
    ...state, source: original, plan: capture, sourceKind: 'canvas', canvasDescription, results,
    redraws: undefined, redrawMode: undefined, cenital: undefined,
  });
  return { imageUrl: capture.assetUrl, assetKey: capture.assetKey, sourceUrl: original.assetUrl, sourceKey: original.assetKey,
    studioResult: results.find((item) => item.assetKey === capture.assetKey) };
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
  // El trabajo anterior queda en la galería; el nuevo origen empieza sin
  // redibujados ni render activos de otro plano.
  const results = appendStudioResult(state, source, { kind: 'source' });
  return importPlanFromImage(ctx, projectId, source, options, {
    ...state, source, plan: source, sourceKind: 'upload', redraws: undefined,
    cenital: undefined, canvasDescription: undefined, results,
  });
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
  // Extraer una captura del editor solo pierde información (puertas sin arco): ese plano ya es editable.
  if (isEditorCapture(state, state.plan.assetKey))
    fail('Este plano es una captura del editor y ya es editable: ábrelo en el Editor. Para revisar medidas, usa el boceto original o un redibujado.');
  return importPlanFromImage(ctx, projectId, state.plan, options, state);
}

/** Vuelve a un origen o redibujado guardado sin confundir sus medidas con las de otro plano. */
export async function selectStudioResult(projectId: string, assetKey: string) {
  return runAction(() => selectStudioResultImpl(projectId, assetKey));
}

async function selectStudioResultImpl(projectId: string, assetKey: string) {
  const { ctx, state } = await context(projectId);
  const results = studioResults(state);
  const selected = results.find((item) => item.assetKey === assetKey);
  if (!selected || selected.kind === 'render') fail('Este resultado no es un plano de trabajo.');
  if (selected.kind === 'canvas') {
    // Una captura vuelve como plano de trabajo para generar vistas; el original no cambia.
    const planUrl = await resolveRenderUrl({ assetKey: selected.assetKey });
    if (!planUrl) fail('No se pudo recuperar el plano guardado.');
    await saveStudio(ctx, projectId, { ...state, results, plan: { assetKey: selected.assetKey, assetUrl: planUrl }, sourceKind: 'canvas',
      redraws: undefined, redrawMode: undefined, cenital: undefined });
    return { imageUrl: planUrl, sourceUrl: state.source?.assetUrl ?? planUrl, assetKey: selected.assetKey };
  }
  const sourceKey = selected.kind === 'source' ? selected.assetKey : selected.sourceKey;
  if (!sourceKey || !results.some((item) => item.kind === 'source' && item.assetKey === sourceKey)) {
    fail('No se encuentra el original de este redibujado.');
  }
  const sourceUrl = await resolveRenderUrl({ assetKey: sourceKey });
  const planUrl = await resolveRenderUrl({ assetKey: selected.assetKey });
  if (!sourceUrl || !planUrl) fail('No se pudo recuperar el plano guardado.');
  const source = { assetKey: sourceKey, assetUrl: sourceUrl };
  const plan = { assetKey: selected.assetKey, assetUrl: planUrl };
  await saveStudio(ctx, projectId, {
    ...state, results, source, plan, sourceKind: 'upload',
    plano: undefined, planImport: undefined, planImportApplied: false,
    planImportRevision: undefined, quality: undefined,
    cenital: undefined, canvasDescription: undefined, escalaEstimada: undefined,
    redrawMode: selected.kind === 'redraw' ? selected.mode : undefined,
    redraws: undefined,
    ...(selected.kind === 'redraw' ? {
      redraws: { [selected.mode ?? 'tecnico']: plan },
    } : {}),
  });
  return { imageUrl: planUrl, sourceUrl, assetKey: selected.assetKey };
}

/** Una captura del editor guardada en el estudio (de esta versión o, en datos anteriores, con el estudio en modo editor). */
function isEditorCapture(state: StudioState, assetKey: string | undefined): boolean {
  if (!assetKey) return false;
  const result = studioResults(state).find((item) => item.assetKey === assetKey);
  return result?.kind === 'canvas' || (state.sourceKind === 'canvas' && state.plan?.assetKey === assetKey);
}

/**
 * Elige el fondo del editor («Mostrar original») entre el boceto y los redibujados guardados. Se alinea con los muros del
 * plano del editor (sin IA); una captura del editor o un render no valen como fondo.
 */
export async function setEditorBackgroundStudio(projectId: string, assetKey: string) {
  return runAction(async () => {
    const { ctx, state } = await context(projectId);
    const selected = studioResults(state).find((item) => item.assetKey === assetKey);
    if (!selected || (selected.kind !== 'source' && selected.kind !== 'redraw') || isEditorCapture(state, assetKey))
      fail('Solo el boceto original o un redibujado pueden ser el fondo del editor.');
    const editor = await withEditorDocuments(ctx).load({ projectId });
    if (editor.authority !== 'v2' || editor.document.walls.length === 0) fail('Envía primero un plano al editor.');
    const assetUrl = await resolveRenderUrl({ assetKey });
    if (!assetUrl) fail('No se pudo recuperar la imagen guardada.');
    const image = { assetKey, assetUrl };
    let frame: EditorBackground['frame'];
    try {
      frame = await fitBackgroundFrame(Buffer.from((await readStudioImage(image)).base64, 'base64'), editor.document);
    } catch (error) {
      fail(error instanceof Error ? error.message : 'No se pudo alinear la imagen con el plano.');
    }
    await saveStudio(ctx, projectId, { ...state, editorReference: { image, frame } });
    return { ok: true };
  });
}

/** Prepara otro plano conservando el historial y las preferencias no geométricas. */
export async function startNewStudioPlan(projectId: string) {
  return runAction(async () => {
    const { ctx, state } = await context(projectId);
    await saveStudio(ctx, projectId, {
      results: studioResults(state), estilo: state.estilo, detalles: state.detalles, editorReference: state.editorReference,
    });
    return { ok: true };
  });
}

/**
 * Recalcula la importación con las medidas corregidas en la tabla (sin volver
 * a llamar a la IA: la extracción cruda quedó guardada en el estudio).
 */
export async function refitPlanImportStudio(
  projectId: string,
  roomOverrides: WrittenRoomDimensions[],
  options: PlanImportReviewOptions = {},
) {
  return runAction(() => refitPlanImportStudioImpl(projectId, roomOverrides, options));
}

async function refitPlanImportStudioImpl(
  projectId: string,
  roomOverrides: WrittenRoomDimensions[],
  options: PlanImportReviewOptions = {},
): Promise<PlanImportResult & { quality: StudioQuality; revision: string; wallOverrides: PlanWallOverride[] }> {
  const { ctx, state } = await context(projectId);
  if (!state.planImport) fail('Importa un plano primero.');
  if (options.revision && options.revision !== state.planImportRevision)
    fail('La revisión cambió. Recarga antes de guardar tus cambios.');
  const { raw, detected } = state.planImport;
  const width = options.generalWidthMm === undefined
    ? state.planImport.generalWidthMm : options.generalWidthMm;
  const generalWidthMm =
    typeof width === 'number' && Number.isFinite(width) && width >= 1000 && width <= 100000 ? Math.round(width) : undefined;
  const safeOverrides = sanitizeOverrides(roomOverrides);
  const doorOverrides = sanitizeDoorOverrides(options.doorOverrides ?? state.planImport.doorOverrides);
  const wallOverrides = options.wallOverrides ?? state.planImport.wallOverrides ?? [];
  const includeFurniture = options.includeFurniture ?? state.planImport.includeFurniture ?? true;
  const result = buildPlanImport(raw, {
    roomOverrides: safeOverrides,
    doorOverrides,
    wallOverrides,
    includeFurniture,
    ...(generalWidthMm !== undefined ? { generalWidthMm } : {}),
    normalize: importNormalizeOptions(detected),
  });
  // Guardar la revisión no genera gasto IA ni convierte un bloqueo en aprobación.
  // Las llamadas que solicitan evaluación mantienen la puerta de fiabilidad.
  const quality: StudioQuality = options.saveOnly ? {
    score: null, decision: blockingPlanImportWarning(result.warnings) || state.quality?.decision === 'block' ? 'block' : 'confirm',
    reasons: [...new Set([...(state.quality?.decision === 'block' ? state.quality.reasons : []),
      'Revisión manual guardada. Comprueba la geometría y las medidas antes de continuar.'])], failOpen: false,
  } : await evaluatePlanQuality(ctx, projectId, state.planImport.image, {
    raw,
    detected,
    result,
  });
  const revision = crypto.randomUUID();
  await saveStudio(ctx, projectId, {
    ...state,
    planImport: {
      ...state.planImport, roomOverrides: safeOverrides,
      doorOverrides,
      wallOverrides,
      includeFurniture,
      generalWidthMm,
    },
    plano: result.plano,
    escalaEstimada: result.escalaEstimada,
    quality,
    planImportApplied: false,
    planImportRevision: revision,
  }, { expectedImportRevision: state.planImportRevision });
  return { ...result, quality, revision, wallOverrides };
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
  if (!state.planImport) fail('Importa y revisa un plano antes de enviarlo al editor.');
  // El navegador solo confirma la revisión que vio. Reconstruir desde la
  // extracción y las correcciones guardadas impide aplicar cotas/objetos de
  // otra importación o falsear `escalaEstimada` desde el cliente.
  const canonical = buildPlanImport(state.planImport.raw, {
    normalize: importNormalizeOptions(state.planImport.detected),
    roomOverrides: state.planImport.roomOverrides,
    doorOverrides: state.planImport.doorOverrides,
    wallOverrides: state.planImport.wallOverrides,
    generalWidthMm: state.planImport.generalWidthMm,
    includeFurniture: state.planImport.includeFurniture,
  });
  const payload = (value: PlanImportResult) => ({
    plano: value.plano,
    sourceFrameMm: value.sourceFrameMm,
    escalaEstimada: value.escalaEstimada,
    writtenDimensions: value.writtenDimensions,
    corrections: value.corrections,
    exteriors: value.exteriors,
    furniture: value.furniture,
    warnings: value.warnings,
  });
  // La acción y JSONB pueden omitir `undefined` o reordenar claves: comparar
  // solo el valor serializable que el navegador realmente confirma.
  if (!result || !isDeepStrictEqual(JSON.parse(JSON.stringify(payload(result))), JSON.parse(JSON.stringify(payload(canonical)))))
    fail('El plano cambió desde la revisión. Recalcula las medidas y confirma de nuevo.');
  // Una extracción guardada puede reabrirse tras mejorar el reconstruidor. El
  // usuario confirma el plano canónico que acaba de ver; el JSON vectorial
  // persistido antes de esa mejora no debe impedir llevarlo al editor.
  const cachedMatches = isDeepStrictEqual(state.plano, JSON.parse(JSON.stringify(canonical.plano)));
  const unsafe = blockingPlanImportWarning(canonical.warnings);
  const quality = unsafe ? {
    score: null,
    decision: 'block' as const,
    reasons: [unsafe.message, 'Corrige la distribución en el editor antes de generar diseños o vistas.'],
    failOpen: false,
  } : !cachedMatches && state.quality?.decision === 'proceed'
    ? await evaluatePlanQuality(ctx, projectId, state.planImport.image, { raw: state.planImport.raw, detected: state.planImport.detected, result: canonical })
    : state.quality;
  assertPlanoRasterizable(canonical.plano);
  const { issues } = await importPlanToEditor(ctx, projectId, canonical, quality);
  // El fondo del editor pasa a ser la imagen de la que sale este plano, alineada con su encuadre.
  const frame = canonical.sourceFrameMm;
  await saveStudio(ctx, projectId, {
    ...state, plano: canonical.plano, escalaEstimada: canonical.escalaEstimada,
    quality, planImportApplied: true, planImportRevision: crypto.randomUUID(),
    editorReference: state.planImport.image && frame
      ? { image: state.planImport.image, frame: { x: 0, y: 0, width: frame.width, height: frame.height } } : state.editorReference,
  });
  // El plano se lleva al editor para corregirlo. Un bloqueo de calidad o una
  // escala aún estimada impiden generar hasta revisar el documento.
  return { issues, needsCorrection: quality?.decision === 'block' || canonical.escalaEstimada };
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

function sanitizeDoorOverrides(items: PlanDoorOverride[] | undefined): PlanDoorOverride[] {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 100).flatMap((item) =>
    item && typeof item.apertureId === 'string' && item.apertureId.length <= 64 &&
    (item.swing === undefined || item.swing === 'left' || item.swing === 'right') &&
    (item.hinge === undefined || item.hinge === 'left' || item.hinge === 'right')
      ? [{ apertureId: item.apertureId,
        ...(item.swing ? { swing: item.swing } : {}), ...(item.hinge ? { hinge: item.hinge } : {}),
        ...(typeof item.position === 'number' && Number.isFinite(item.position) && item.position >= 0 && item.position <= 1
          ? { position: item.position } : {}),
        ...(item.widthMm !== undefined ? { widthMm: item.widthMm } : {}) }]
      : []);
}
