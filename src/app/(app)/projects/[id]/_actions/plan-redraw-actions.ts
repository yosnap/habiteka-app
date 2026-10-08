'use server';

/**
 * Redibujado del plano que propone Jev en la revisión de la pestaña Plano.
 *
 * Jev decide: si no da por buena la lectura del plano subido, se ofrece
 * redibujarlo como plano técnico limpio con su precio y volver a leerlo. El gasto
 * usa solo el modelo y precio que el usuario autorizó, y la nueva lectura vuelve a
 * pasar por el veredicto de Jev. Volver a leer una imagen ya generada no genera otra.
 */
import { requireOrgContext } from '@/server/auth/require-org-context';
import { assertConsent } from '@/server/privacy/consent-service';
import { assertTosAccepted } from '@/server/legal/tos-acceptance-service';
import { loadStudio } from '@/server/plan/studio-repo';
import { importPlanFromImage } from '@/server/plan/import-plan-from-image';
import { runAction, fail } from '@/server/errors/run-action';
import { redrawStudioSource } from '@/server/plan/studio-redraw';
import { resolveRoutes } from '@/server/ai/model-routing';
import { allowedModel } from '@/server/admin/config/model-allowlist';

/**
 * Modelo y precio de una imagen generada (redibujado o vista del plano): el
 * principal de «Render 3D» en Modelos por uso.
 */
export async function imageGenerationQuote(projectId: string) {
  return runAction(async () => {
    const ctx = await requireOrgContext();
    await loadStudio(ctx, projectId);
    const route = (await resolveRoutes('render3d')).find((item) => item.provider !== 'nan');
    const model = route && allowedModel('render3d', route.model, route.provider);
    if (!route || !model) fail('No hay un modelo de imagen configurado para generar imágenes.');
    return { provider: route.provider, model: route.model, label: model.label, priceUsd: model.priceUsdPerUnit };
  });
}

/** Redibuja el plano subido como plano técnico y lo vuelve a leer, si Jev no da por buena la lectura actual. */
export async function redrawPlanForReview(
  projectId: string,
  route: { provider: string; model: string; maxUsd: number },
) {
  return runAction(async () => {
    const ctx = await requireOrgContext();
    const state = await loadStudio(ctx, projectId);
    await assertConsent(ctx.userId, 'IMAGE_PROCESSING');
    await assertTosAccepted(ctx.userId);
    if (!state.source || !state.planImport) fail('Sube primero tu plano y extrae sus medidas.');
    if (state.quality?.decision === 'proceed')
      fail('Jev da por buena la lectura de tu plano: no hace falta redibujarlo.');
    const includeFurniture = state.planImport.includeFurniture === true;
    const redrawn = await redrawStudioSource(ctx, projectId, state, state.source, 'tecnico', route);
    const imported = await importPlanFromImage(ctx, projectId, redrawn.result, { includeFurniture }, redrawn.state);
    return { ...imported, includeFurniture, sourceUrl: state.source.assetUrl };
  });
}

/** Vuelve a leer el original o el redibujado técnico ya generado: solo repite la lectura y el veredicto de Jev. */
export async function rereadPlanForReview(projectId: string, image: 'source' | 'tecnico') {
  return runAction(async () => {
    const ctx = await requireOrgContext();
    const state = await loadStudio(ctx, projectId);
    await assertConsent(ctx.userId, 'IMAGE_PROCESSING');
    await assertTosAccepted(ctx.userId);
    const plan = image === 'source' ? state.source : state.redraws?.tecnico;
    if (!state.source || !plan) fail('Esa imagen ya no está disponible. Sube el plano de nuevo.');
    const includeFurniture = state.planImport?.includeFurniture === true;
    const imported = await importPlanFromImage(ctx, projectId, plan, { includeFurniture }, {
      ...state, plan, redrawMode: image === 'source' ? undefined : 'tecnico',
    });
    return { ...imported, includeFurniture, sourceUrl: state.source.assetUrl };
  });
}
