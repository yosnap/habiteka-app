/**
 * Lectura de un plano dibujado desde una imagen ya persistida: extracción
 * (visión + raster), ajuste a cotas y puerta de fiabilidad con Jev.
 *
 * Vive aquí, fuera de las Server Actions, porque lo usan dos entradas distintas
 * (el estudio del plano y el asistente por pasos) y el pipeline debe ser uno
 * solo: mismo prompt, misma evidencia, mismo veredicto y mismo guardado.
 */
import type { OrgContext } from '@/server/auth/org-context';
import type { PlanImportResult } from '@/lib/contracts';
import type { StudioImage, StudioQuality, StudioState } from '@/lib/studio-state';
import { readStudioImage } from './studio-image';
import { saveStudio } from './studio-repo';
import { getChatVisionAdapter } from '@/server/ai';
import { extractPlanSource } from './extract-plan-source';
import { buildPlanImport } from './build-plan-import';
import type { DetectedWalls } from './detect-walls-raster';
import { evaluateCheckpoint } from '@/server/quality/evaluate';
import type { GateContext } from '@/server/quality/gate-mark';
import { buildPlanEvidence } from '@/server/quality/evidence/plan-evidence';
import { blockingPlanImportWarning } from '@/lib/plan-quality';

/** Importación con la imagen de origen y el veredicto de fiabilidad del plano. */
export type PlanImportStudioResult = PlanImportResult & {
  imageUrl: string;
  quality: StudioQuality;
};

/** Extracción (visión + raster) → importación; guarda la extracción cruda para recalcular sin IA. */
export async function importPlanFromImage(
  ctx: OrgContext,
  projectId: string,
  imageRef: StudioImage,
  options: { includeFurniture?: boolean },
  nextState: StudioState,
): Promise<PlanImportStudioResult> {
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
  const quality = await evaluatePlanQuality(ctx, projectId, imageRef, { raw, detected, result });
  await saveStudio(ctx, projectId, {
    ...nextState,
    plano: result.plano,
    escalaEstimada: result.escalaEstimada,
    planImport: { raw, detected, image: imageRef, includeFurniture: options.includeFurniture !== false },
    planImportApplied: false,
    planImportRevision: crypto.randomUUID(),
    quality,
  });
  return { ...result, imageUrl: imageRef.assetUrl, quality };
}

/**
 * Puerta de fiabilidad del plano: Jev puntúa la evidencia medible de la
 * extracción (nunca la imagen) y su decisión gobierna lo que puede hacerse
 * después. Barato y repetible: también se reevalúa al recalcular medidas.
 *
 * Con `gate`, la evaluación queda marcada como paso de puerta de una acción de
 * pago concreta; sin él es informativa (leer un plano no gasta generaciones).
 */
export async function evaluatePlanQuality(
  ctx: OrgContext,
  projectId: string,
  imageRef: StudioImage | undefined,
  input: Parameters<typeof buildPlanEvidence>[0],
  gate?: GateContext,
): Promise<StudioQuality> {
  const unsafe = blockingPlanImportWarning(input.result.warnings);
  if (unsafe) return {
    score: null,
    decision: 'block',
    reasons: [unsafe.message, 'Corrige la distribución en el editor antes de generar diseños o vistas.'],
    failOpen: false,
  };
  const evaluation = await evaluateCheckpoint(
    ctx,
    'plan_extraction',
    buildPlanEvidence(input),
    { projectId, refId: imageRef?.assetKey ?? null },
    gate,
  );
  return {
    score: evaluation.score,
    decision: evaluation.decision,
    reasons: evaluation.reasons,
    failOpen: evaluation.failOpen,
  };
}

export function importNormalizeOptions(detected: DetectedWalls | null) {
  return detected
    ? { wallsOverride: detected.walls, imageHeightOverWidth: detected.heightOverWidth }
    : {};
}
