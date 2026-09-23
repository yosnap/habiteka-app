'use server';

/**
 * Acciones de la pestaña «Diseños» sobre un entregable ya generado:
 * - pedir un cambio con texto (nueva versión del render, del plano o de la memoria);
 * - preparar una variante (el asistente vuelve a la elección de estilo y entregables).
 *
 * Toda entrada pasa por la organización de la sesión (anti-IDOR) antes de tocar la IA
 * o el cobro, y la iteración exige consentimiento y ToS como la entrega inicial.
 */
import { revalidatePath } from 'next/cache';
import { requireOrgContext } from '@/server/auth/require-org-context';
import type { OrgContext } from '@/server/auth/org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { runAction, fail } from '@/server/errors/run-action';
import { assertConsent } from '@/server/privacy/consent-service';
import { assertTosAccepted } from '@/server/legal/tos-acceptance-service';
import { randomUUID } from 'node:crypto';
import { runFeedback } from '@/server/agent/feedback/feedback-orchestrator';
import { loadDeliverable } from '@/server/agent/feedback/iteration-repo';
import { buildFeedbackDeps, ITERATION_CREDITS } from '@/server/agent/feedback/feedback-deps';
import { isDrawablePlanZone } from '@/lib/contracts/plano2d-validation';
import { loadState, saveState } from '@/server/agent/persistence/state-repo';

const MIN_INSTRUCTION = 3;
const MAX_INSTRUCTION = 500;

async function assertProjectInOrg(ctx: OrgContext, projectId: string): Promise<void> {
  const project = await withOrg(ctx).projects.findById(projectId);
  if (!project) fail('Proyecto no encontrado en tu organización');
}

/**
 * Pide un cambio con texto sobre un diseño. Crea una versión NUEVA (la anterior se
 * conserva). En un plano con varias estancias, `planZoneId` indica cuál rehacer.
 */
export async function requestDeliverableChange(
  projectId: string,
  deliverableId: string,
  instruction: string,
  planZoneId?: string,
) {
  return runAction(() => requestDeliverableChangeImpl(projectId, deliverableId, instruction, planZoneId));
}

async function requestDeliverableChangeImpl(
  projectId: string,
  deliverableId: string,
  instruction: string,
  planZoneId?: string,
): Promise<{ newDeliverableId: string; version: number }> {
  const text = typeof instruction === 'string' ? instruction.trim() : '';
  if (text.length < MIN_INSTRUCTION) fail('Describe el cambio que quieres (al menos unas palabras).');
  if (text.length > MAX_INSTRUCTION) fail(`El cambio no puede superar ${MAX_INSTRUCTION} caracteres.`);

  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  const deliverable = await loadDeliverable(ctx.organizationId, deliverableId);
  if (deliverable.projectId !== projectId) fail('El diseño no pertenece a este proyecto.');
  await assertConsent(ctx.userId, 'IMAGE_PROCESSING');
  await assertTosAccepted(ctx.userId);

  const result = await runFeedback(
    await buildFeedbackDeps(ctx.organizationId, deliverable),
    {
      organizationId: ctx.organizationId,
      deliverableId,
      // El cambio por texto es global: la "zona" es la imagen completa.
      zone: { id: 'global', bbox: { x: 0, y: 0, width: 1, height: 1 } },
      instruction: text,
      ...(deliverable.type === 'PLANO_2D' ? { planZoneId: planZoneId ?? firstPlanZoneId(deliverable.payload) } : {}),
      estimateCredits: ITERATION_CREDITS,
      attemptId: randomUUID(),
    },
  );
  revalidatePath(`/projects/${projectId}/deliverables`);
  return result;
}

/** Primera estancia DIBUJABLE: el visor omite las zonas sin geometría. */
function firstPlanZoneId(payload: unknown): string | undefined {
  const zones = (payload as { plano?: { zones?: unknown[] } })?.plano?.zones;
  const zone = Array.isArray(zones) ? zones.find(isDrawablePlanZone) : undefined;
  return zone?.id;
}

/**
 * Prepara una variante: si el asistente de esa zona ya entregó, vuelve a la elección
 * de estilo y entregables conservando la foto y la detección. No cobra ni genera.
 */
export async function startDesignVariant(projectId: string, zoneId: string | null = null) {
  return runAction(() => startDesignVariantImpl(projectId, zoneId));
}

async function startDesignVariantImpl(projectId: string, zoneId: string | null): Promise<{ ok: true }> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  if (zoneId) {
    const zones = await withOrg(ctx).zones.list(projectId);
    if (!zones.some((z) => z.id === zoneId)) fail('Zona no encontrada en el proyecto');
  }
  // Mismo retroceso que «Volver al paso anterior» del asistente (feedback → cualificación).
  const state = await loadState(projectId, zoneId);
  if (state.phase === 'feedback') {
    await saveState(projectId, zoneId, state.version, { phase: 'cualificacion', collected: state.collected });
  }
  return { ok: true };
}
