/**
 * Endpoint de iteraciones de feedback.
 *
 * POST: crea una nueva versión del entregable modificando solo la zona indicada.
 * GET: devuelve el historial de iteraciones de un entregable. El acceso resuelve
 * la organización de la sesión y pasa por el repositorio con ámbito, de modo que
 * nadie itera ni consulta entregables de otra organización.
 */
import { NextResponse } from 'next/server';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { buildFeedbackDeps, ITERATION_CREDITS } from '@/server/agent/feedback/feedback-deps';
import { runFeedback } from '@/server/agent/feedback/feedback-orchestrator';
import { listIterations, loadDeliverable } from '@/server/agent/feedback/iteration-repo';
import { assertTosAccepted } from '@/server/legal/tos-acceptance-service';
import { assertConsent } from '@/server/privacy/consent-service';
import type { CanvasZone } from '@/lib/contracts';

export async function POST(request: Request) {
  const ctx = await requireOrgContext();
  const body = (await request.json()) as {
    deliverableId?: string;
    zone?: CanvasZone;
    instruction?: string;
    planZoneId?: string;
  };
  if (!body.deliverableId || !body.zone || !body.instruction) {
    return NextResponse.json({ error: 'payload incompleto' }, { status: 400 });
  }

  // La iteración regenera imagen (trata la foto) y produce una nueva versión del
  // entregable: exige consentimiento RGPD y aceptación del ToS, igual que la
  // entrega inicial. Sin ellos, no se gasta crédito ni se llama a la IA.
  try {
    await assertConsent(ctx.userId, 'IMAGE_PROCESSING');
    await assertTosAccepted(ctx.userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'requisito legal no cumplido';
    return NextResponse.json({ error: message }, { status: 403 });
  }

  try {
    // Mismas dependencias que «Diseños»: imagen base desde storage, memoria y plano.
    const deliverable = await loadDeliverable(ctx.organizationId, body.deliverableId);
    const result = await runFeedback(
      await buildFeedbackDeps(ctx.organizationId, deliverable),
      {
        organizationId: ctx.organizationId,
        deliverableId: body.deliverableId,
        zone: body.zone,
        instruction: body.instruction,
        planZoneId: body.planZoneId,
        estimateCredits: ITERATION_CREDITS,
      },
    );
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error de iteración';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

export async function GET(request: Request) {
  const ctx = await requireOrgContext();
  const deliverableId = new URL(request.url).searchParams.get('deliverableId');
  if (!deliverableId) {
    return NextResponse.json({ error: 'deliverableId requerido' }, { status: 400 });
  }
  const history = await listIterations(ctx.organizationId, deliverableId);
  return NextResponse.json({ history });
}
