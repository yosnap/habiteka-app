/**
 * Paso 0 del asistente: qué quiere hacer el usuario (crear un diseño a partir de
 * una foto, o convertir su plano al editor).
 *
 * Es determinista y barato: no pasa por ningún modelo, solo valida el valor y lo
 * persiste en `collected` para que el asistente retome la ruta al recargar. Vive
 * fuera del orquestador para no engordarlo.
 */
import type { AssistantIntent, Collected } from '@/lib/contracts';
import { saveState } from '../persistence/state-repo';
import { agentError } from '../errors';

const INTENTS: readonly AssistantIntent[] = ['design', 'plan'];

export function isAssistantIntent(value: unknown): value is AssistantIntent {
  return typeof value === 'string' && (INTENTS as readonly string[]).includes(value);
}

/**
 * Fija la ruta del asistente. Solo durante la ingesta: una vez cualificando o
 * entregando, cambiar de ruta invalidaría lo recogido; el usuario vuelve atrás
 * con `go-back` y entonces sí puede cambiarla.
 */
export async function setIntent(
  projectId: string,
  zoneId: string | null,
  phase: string,
  collected: Collected,
  version: number,
  intent: unknown,
): Promise<{ phase: 'ingesta'; collected: Collected }> {
  if (phase !== 'ingesta') {
    throw agentError('phase_guard', 'La ruta del asistente solo se elige al principio');
  }
  if (!isAssistantIntent(intent)) {
    throw agentError('phase_guard', 'Ruta del asistente no válida');
  }
  const next: Collected = { ...collected, intent };
  await saveState(projectId, zoneId, version, { phase: 'ingesta', collected: next });
  return { phase: 'ingesta', collected: next };
}
