import 'server-only';

/**
 * Puerta de calidad previa a cualquier generación de pago que parte del editor.
 *
 * Regla única para render, diseño, propuesta nativa y el futuro recorrido/vídeo:
 * Jev puntúa la salud estructural del documento y su decisión manda.
 * `proceed` sigue; `confirm` exige que el usuario confirme expresamente (el
 * servidor vuelve a evaluar, nunca se fía del cliente); `block` corta antes de
 * resolver el modelo de imagen, de modo que un plano roto no cuesta dinero.
 *
 * La evaluación se cachea por `evidenceHash`: un documento sin cambios no se
 * vuelve a pagar. Jev caído o sin clave nunca deja pasar solo: cae a `confirm`.
 */
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { QualityVerdict } from '@/lib/quality-verdict';
import { CONFIRM_HINT } from '@/lib/quality-messages';
import { fail } from '@/server/errors/run-action';
import { evaluateCheckpointCached, type QualityContext } from './evaluate';
import type { GateContext } from './gate-mark';
import { buildEditorEvidence } from './evidence/editor-evidence';
import { editorGeometryFingerprint } from './editor-geometry-fingerprint';

export const EDITOR_STRUCTURE_CHECKPOINT = 'editor_structure';

export interface EditorQualityScope {
  projectId: string;
  zoneId?: string | null;
}

/**
 * Evalúa el documento del editor. Sin `gate` la evaluación es informativa (la
 * tarjeta del diálogo): juzga exactamente el mismo documento que juzgará la
 * puerta, de modo que la caché por evidencia sirva a la generación y el usuario
 * nunca vea una tarjeta que contradiga al servidor.
 */
export async function editorDocumentQuality(
  ctx: QualityContext,
  scope: EditorQualityScope,
  document: EditorDocument,
  gate?: GateContext,
): Promise<QualityVerdict> {
  if (document.importReview?.geometryFingerprint === editorGeometryFingerprint(document))
    return {
      score: null,
      decision: 'block',
      reasons: document.importReview.reasons,
      failOpen: false,
    };
  const evidence = buildEditorEvidence(document);
  // Una escala conjeturada no se convierte en física por una puntuación alta
  // del evaluador ni por aceptar un aviso: hay que calibrar el documento.
  if (evidence.murosSinMedidaFisica > 0 && !evidence.escalaConocida)
    return {
      score: null,
      decision: 'block',
      reasons: ['El plano procede de una imagen sin escala física confirmada. Define una cota real antes de generar.'],
      failOpen: false,
    };
  const evaluation = await evaluateCheckpointCached(
    ctx,
    EDITOR_STRUCTURE_CHECKPOINT,
    evidence,
    { projectId: scope.projectId, refId: scope.zoneId ?? null },
    gate,
  );
  // Jev solo ve la estructura actual, no la imagen de origen. Después de una
  // corrección geométrica, la comparación visual sigue requiriendo aceptación.
  if (document.importReview && evaluation.decision === 'proceed') return {
    score: evaluation.score,
    decision: 'confirm',
    reasons: [
      'La geometría cambió desde la importación. Comprueba que coincide con el plano original antes de generar.',
      ...document.importReview.reasons.slice(0, 2),
    ],
    failOpen: false,
  };
  return {
    score: evaluation.score,
    decision: evaluation.decision,
    reasons: evaluation.reasons,
    failOpen: evaluation.failOpen,
  };
}

/**
 * Comprueba la salud estructural antes de gastar. Lanza un error de usuario si
 * el plano está bloqueado o si hace falta una confirmación que no ha llegado.
 * Devuelve el veredicto para que quien llama pueda registrarlo.
 */
export async function assertEditorQuality(
  ctx: QualityContext,
  scope: EditorQualityScope,
  document: EditorDocument,
  ack = false,
  action = 'generacion_editor',
): Promise<QualityVerdict> {
  const quality = await editorDocumentQuality(ctx, scope, document, { action });
  if (quality.decision === 'block') fail(blockedMessage(quality.reasons));
  if (quality.decision === 'confirm' && ack !== true) fail(confirmMessage(quality.reasons));
  return quality;
}

function blockedMessage(reasons: string[]): string {
  return [
    'El plano no está en condiciones de generar: no hemos gastado nada.',
    ...bullets(reasons),
    'Corrige el plano en el editor (cierra las estancias, une los muros y define la escala) y vuelve a intentarlo.',
  ].join('\n');
}

function confirmMessage(reasons: string[]): string {
  return [
    'Hay dudas sobre el plano y la generación se ha detenido antes de gastar.',
    ...bullets(reasons),
    CONFIRM_HINT,
  ].join('\n');
}

function bullets(reasons: string[]): string[] {
  return reasons.slice(0, 5).map((reason) => `· ${reason}`);
}
