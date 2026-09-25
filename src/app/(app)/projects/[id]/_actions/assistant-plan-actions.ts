'use server';

/**
 * Ruta «convertir mi plano al editor» del asistente por pasos.
 *
 * Es la misma lectura de plano que el estudio (`importPlanFromImage`): mismo
 * pipeline de extracción, misma evidencia y el mismo veredicto de fiabilidad de
 * Jev. Aquí solo se aportan los gates (consentimiento de imagen, ToS y
 * pertenencia del proyecto a la organización) y la imagen recién subida.
 *
 * Aplicar la importación al editor se hace con `applyPlanImportStudio`, que lee
 * la decisión guardada en el servidor y no la que diga el navegador.
 */
import { requireOrgContext } from '@/server/auth/require-org-context';
import { assertConsent } from '@/server/privacy/consent-service';
import { assertTosAccepted } from '@/server/legal/tos-acceptance-service';
import { loadStudio } from '@/server/plan/studio-repo';
import { appendStudioResult } from '@/lib/studio-results';
import { persistStudioSource } from '@/server/plan/studio-image';
import {
  importPlanFromImage,
  type PlanImportStudioResult,
} from '@/server/plan/import-plan-from-image';
import { runAction } from '@/server/errors/run-action';

/**
 * Lee el plano que el usuario acaba de subir en el asistente y devuelve la
 * importación con su fiabilidad. No toca el editor: el usuario revisa el plano
 * leído y confirma después (reemplaza el plano del proyecto).
 */
export async function importPlanForAssistant(projectId: string, base64: string) {
  return runAction(() => importPlanForAssistantImpl(projectId, base64));
}

async function importPlanForAssistantImpl(
  projectId: string,
  base64: string,
): Promise<PlanImportStudioResult> {
  const ctx = await requireOrgContext();
  // La pertenencia del proyecto a la organización la impone la carga del estudio.
  const state = await loadStudio(ctx, projectId);
  await assertConsent(ctx.userId, 'IMAGE_PROCESSING');
  await assertTosAccepted(ctx.userId);
  const source = await persistStudioSource(base64);
  // Se conserva el resto del estudio (redibujados incluidos): subir un plano en el
  // asistente no debe borrar trabajo hecho en el estudio del plano.
  return importPlanFromImage(
    ctx,
    projectId,
    source,
    // En el asistente se importa la ESTRUCTURA; el mobiliario leído se descarta
    // para que el usuario amueble en el editor.
    { includeFurniture: false },
    {
      ...state, source, plan: source, sourceKind: 'upload',
      redraws: undefined, cenital: undefined, canvasDescription: undefined,
      results: appendStudioResult(state, source, { kind: 'source' }),
    },
  );
}
