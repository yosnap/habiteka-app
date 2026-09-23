import 'server-only';

/**
 * Puerta de calidad de las instrucciones de cambio, ANTES de gastar.
 *
 * Se evalúa el texto del usuario antes de reservar créditos y antes de llamar a
 * la IA de imagen: una petición que no se entiende no debe costar dinero.
 * `proceed` sigue; `confirm` exige confirmación expresa del usuario (el servidor
 * la vuelve a evaluar, nunca se fía del cliente); `block` corta y pide
 * reformular. Jev caído o sin clave cae a `confirm` (fail-closed), nunca a
 * `proceed`.
 *
 * La evaluación se cachea por `evidenceHash`: reabrir el diálogo o reintentar el
 * mismo texto no vuelve a pagar una llamada a Jev.
 */
import type { QualityVerdict } from '@/lib/quality-verdict';
import { CONFIRM_CHANGE_HINT } from '@/lib/quality-messages';
import { fail } from '@/server/errors/run-action';
import { CHANGE_INSTRUCTION_CHECKPOINT } from './checkpoints-instruction';
import { evaluateCheckpointCached, type QualityContext } from './evaluate';
import type { GateContext } from './gate-mark';
import {
  buildInstructionEvidence,
  type InstructionTargetType,
} from './evidence/instruction-evidence';

export { CHANGE_INSTRUCTION_CHECKPOINT };

export interface InstructionScope {
  projectId: string;
  /** Entregable sobre el que se pide el cambio, si lo hay. */
  refId?: string | null;
}

/**
 * Puntúa una instrucción de cambio. Sin `gate` no hay gasto detrás: es la
 * tarjeta que la UI enseña antes de decidir.
 */
export async function instructionQuality(
  ctx: QualityContext,
  scope: InstructionScope,
  deliverableType: InstructionTargetType,
  instruction: string,
  gate?: GateContext,
): Promise<QualityVerdict> {
  const evaluation = await evaluateCheckpointCached(
    ctx,
    CHANGE_INSTRUCTION_CHECKPOINT,
    buildInstructionEvidence(deliverableType, instruction),
    { projectId: scope.projectId, refId: scope.refId ?? null },
    gate,
  );
  return {
    score: evaluation.score,
    decision: evaluation.decision,
    reasons: evaluation.reasons,
    failOpen: evaluation.failOpen,
  };
}

/**
 * Comprueba la instrucción antes de gastar. Lanza un error de usuario si hay que
 * reformularla o si falta la confirmación expresa. Devuelve el veredicto para
 * que quien llama pueda registrarlo.
 */
export async function assertInstructionQuality(
  ctx: QualityContext,
  scope: InstructionScope,
  deliverableType: InstructionTargetType,
  instruction: string,
  ack = false,
  action = 'cambio_entregable',
): Promise<QualityVerdict> {
  const quality = await instructionQuality(ctx, scope, deliverableType, instruction, { action });
  if (quality.decision === 'block') fail(blockedMessage(quality.reasons));
  if (quality.decision === 'confirm' && ack !== true) fail(confirmMessage(quality.reasons));
  return quality;
}

/**
 * Variante para el prompt libre del editor: solo corta con fiabilidad baja.
 *
 * El diálogo del editor ya pide UNA confirmación por la salud del plano (fase 4);
 * pedir una segunda por el texto sería confundir al usuario con dos casillas.
 * Con dudas se sigue, y la banda queda igualmente registrada.
 */
export async function assertFreePromptQuality(
  ctx: QualityContext,
  scope: InstructionScope,
  instruction: string,
  /**
   * Qué admite realmente la acción que se va a ejecutar. Una propuesta editable
   * SÍ cambia muebles y acabados del plano; un render o un diseño no tocan la
   * geometría. Pasar el tipo real evita `block` falsos por «fuera de ámbito».
   */
  target: InstructionTargetType = 'render3d',
  action = 'prompt_libre',
): Promise<QualityVerdict | null> {
  const text = instruction.trim();
  if (!text) return null;
  const quality = await instructionQuality(ctx, scope, target, text, { action });
  if (quality.decision === 'block') fail(blockedMessage(quality.reasons));
  return quality;
}

function blockedMessage(reasons: string[]): string {
  return [
    'No hemos gastado nada: hace falta que reformules la instrucción.',
    ...bullets(reasons),
    'Di qué elemento cambiar y dónde (p. ej. «suelo de madera clara en el salón»).',
  ].join('\n');
}

function confirmMessage(reasons: string[]): string {
  return [
    'La instrucción deja dudas y el cambio se ha detenido antes de gastar.',
    ...bullets(reasons),
    CONFIRM_CHANGE_HINT,
  ].join('\n');
}

function bullets(reasons: string[]): string[] {
  return reasons.slice(0, 5).map((reason) => `· ${reason}`);
}
