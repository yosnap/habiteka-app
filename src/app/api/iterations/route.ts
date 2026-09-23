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
import {
  DeliverableNotFoundError,
  listIterations,
  loadDeliverable,
} from '@/server/agent/feedback/iteration-repo';
import { assertTosAccepted } from '@/server/legal/tos-acceptance-service';
import { assertConsent } from '@/server/privacy/consent-service';
import { assertInstructionQuality } from '@/server/quality/instruction-gate';
import { instructionTargetOf } from '@/server/quality/evidence/instruction-evidence';
import { UserFacingError } from '@/server/errors/user-facing-error';
import type { CanvasZone } from '@/lib/contracts';

export async function POST(request: Request) {
  const ctx = await requireOrgContext();
  const body = (await request.json()) as {
    deliverableId?: string;
    zone?: CanvasZone;
    instruction?: string;
    planZoneId?: string;
    qualityAck?: boolean;
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

  // La instrucción se evalúa ANTES de reservar créditos y de llamar a la IA de
  // imagen: si no es aplicable, se pide reformularla sin gastar nada. Con dudas,
  // hace falta `qualityAck` (confirmación expresa validada aquí, no en el cliente).
  let deliverable;
  try {
    deliverable = await loadDeliverable(ctx.organizationId, body.deliverableId);
    await assertInstructionQuality(
      ctx,
      { projectId: deliverable.projectId, refId: body.deliverableId },
      instructionTargetOf(deliverable.type),
      body.instruction,
      body.qualityAck === true,
      'iteracion_zona',
    );
  } catch (err) {
    return failureResponse(err, 'no se pudo preparar la iteración');
  }

  try {
    // Mismas dependencias que «Diseños»: imagen base desde storage, memoria y plano.
    const result = await runFeedback(
      await buildFeedbackDeps(ctx.organizationId, deliverable),
      {
        organizationId: ctx.organizationId,
        deliverableId: body.deliverableId,
        zone: body.zone,
        instruction: body.instruction,
        planZoneId: body.planZoneId,
        estimateCredits: ITERATION_CREDITS,
        quality: { userId: ctx.userId, projectId: deliverable.projectId },
      },
    );
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return failureResponse(err, 'error de iteración');
  }
}

/**
 * Traduce un fallo a respuesta HTTP sin filtrar detalles internos:
 *  - 404 solo si el entregable no existe,
 *  - 422 con el mensaje del error si es un error pensado para el usuario,
 *  - 500 con un mensaje fijo en cualquier otro caso (un `err.message` de la BD,
 *    del proveedor de IA o del storage no es información del usuario).
 */
function failureResponse(err: unknown, fallback: string) {
  if (err instanceof DeliverableNotFoundError) {
    return NextResponse.json({ error: 'El diseño no existe o no es de tu organización.' }, { status: 404 });
  }
  if (err instanceof UserFacingError) {
    return NextResponse.json({ error: err.message }, { status: 422 });
  }
  console.error('[iterations]', fallback, err);
  return NextResponse.json({ error: 'No se pudo completar la iteración.' }, { status: 500 });
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
