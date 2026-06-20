/**
 * Fase de cualificación: diálogo con herramientas hasta consolidar requisitos.
 *
 * El modelo pregunta y, cuando obtiene un dato, lo registra invocando una
 * herramienta. Aquí se ejecuta el bucle: tras cada respuesta con llamadas a
 * herramienta se actualiza `Collected` y se devuelve el resultado al modelo, hasta
 * que decide `finalizar` o se alcanza el límite de turnos (evita bucles infinitos).
 */
import type { ChatVisionAdapter, ChatMessage, Collected, ToolCall } from '@/lib/contracts';
import { QUALIFICATION_TOOLS, isValidEstilo, parseEntregables } from '../tools/qualification-tools';

const MAX_TURNS = 8;

export interface QualificationResult {
  collected: Collected;
  finalized: boolean;
}

/**
 * Avanza la cualificación a partir del historial y el estado acumulado. Aplica
 * las llamadas a herramienta del modelo a `Collected` y señala si finalizó.
 */
export async function runQualification(
  chat: ChatVisionAdapter,
  history: ChatMessage[],
  collected: Collected,
): Promise<QualificationResult> {
  let current: Collected = { ...collected, entregables: [...collected.entregables] };
  const messages = [...history];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const result = await chat.chat({ model: '', messages, tools: QUALIFICATION_TOOLS });
    const calls = result.toolCalls ?? [];
    if (calls.length === 0) {
      // El modelo respondió en texto (una pregunta): no hay nada que consolidar
      // en este turno; se espera la respuesta del usuario fuera del bucle.
      return { collected: current, finalized: false };
    }

    let finalize = false;
    for (const call of calls) {
      const outcome = applyToolCall(current, call);
      current = outcome.collected;
      if (outcome.finalize) finalize = true;
      // Se devuelve al modelo el resultado de cada herramienta (rol `tool`).
      messages.push({
        role: 'tool',
        toolCallId: call.id,
        content: [{ type: 'text', text: 'ok' }],
      });
    }
    if (finalize) {
      return { collected: current, finalized: true };
    }
  }

  // Se agotó el límite sin finalizar: se devuelve lo acumulado sin forzar entrega.
  return { collected: current, finalized: false };
}

function applyToolCall(
  collected: Collected,
  call: ToolCall,
): { collected: Collected; finalize: boolean } {
  switch (call.name) {
    case 'set_objetivo': {
      const objetivo = call.arguments.objetivo;
      return {
        collected: {
          ...collected,
          objetivo: typeof objetivo === 'string' ? objetivo : collected.objetivo,
        },
        finalize: false,
      };
    }
    case 'set_estilo': {
      const estilo = call.arguments.estilo;
      return {
        collected: { ...collected, estilo: isValidEstilo(estilo) ? estilo : collected.estilo },
        finalize: false,
      };
    }
    case 'set_entregables': {
      const entregables = parseEntregables(call.arguments.entregables);
      return {
        collected: {
          ...collected,
          entregables: entregables.length ? entregables : collected.entregables,
        },
        finalize: false,
      };
    }
    case 'finalizar':
      return { collected, finalize: true };
    default:
      return { collected, finalize: false };
  }
}
