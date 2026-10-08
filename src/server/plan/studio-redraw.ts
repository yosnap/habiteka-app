import 'server-only';
import type { OrgContext } from '@/server/auth/org-context';
import { saveStudio } from '@/server/plan/studio-repo';
import { readStudioImage } from '@/server/plan/studio-image';
import { getChatVisionAdapter, getImageAdapterForAction } from '@/server/ai';
import { withEnglishPrompts } from '@/server/agent/editor-v2/english-image-prompt';
import { redrawPlan, type RedrawMode } from '@/server/ai/design/redraw-plan-pipeline';
import { appendStudioResult } from '@/lib/studio-results';
import type { StudioImage, StudioState } from '@/lib/studio-state';

/**
 * Redibuja con IA el plano `source` y lo deja como imagen de trabajo del estudio.
 * Lo comparten el estudio del plano y el asistente. Con `confirmedRoute` se usa
 * solo el modelo y precio que el usuario autorizó, sin respaldo automático.
 */
export async function redrawStudioSource(
  ctx: OrgContext,
  projectId: string,
  state: StudioState,
  source: StudioImage,
  mode: RedrawMode,
  confirmedRoute?: { provider: string; model: string; maxUsd: number },
) {
  const baseline = source.assetKey !== state.source?.assetKey
    ? { ...state, results: appendStudioResult(state, source, { kind: 'source' }) }
    : state;
  const image = withEnglishPrompts(
    await getImageAdapterForAction({ organizationId: ctx.organizationId }, 'render3d', confirmedRoute),
    () => getChatVisionAdapter({ organizationId: ctx.organizationId, userId: ctx.userId, projectId }, 'vision'),
  );
  const result = await redrawPlan({ image }, await readStudioImage(source), mode);
  // Se conserva el redibujado del otro modo: el usuario alterna entre ambos.
  const redraws = { ...baseline.redraws, [mode]: result };
  // Otra imagen de trabajo: el veredicto y la extracción del plano anterior ya no valen.
  const results = appendStudioResult(baseline, result, {
    kind: 'redraw', mode, ...(source.assetKey ? { sourceKey: source.assetKey } : {}),
  });
  const next: StudioState = {
    ...baseline, source, plan: result, redrawMode: mode, redraws, results,
    sourceKind: 'upload', plano: undefined, escalaEstimada: undefined,
    cenital: undefined, quality: undefined, planImport: undefined,
    planImportApplied: false, planImportRevision: undefined,
  };
  await saveStudio(ctx, projectId, next);
  return { result, results, state: next };
}
