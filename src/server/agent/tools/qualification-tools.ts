/**
 * Herramientas que el modelo invoca durante la cualificación para consolidar los
 * requisitos. El modelo no escribe `Collected` libremente: solo a través de estas
 * herramientas con valores acotados (el estilo y los entregables son enumerados),
 * de modo que el estado resultante siempre es válido.
 */
import type { ToolDefinition, DeliverableType } from '@/lib/contracts';
import {
  ESTILO_VALUES,
  ENTREGABLE_VALUES,
  isValidEstilo as isValidEstiloShared,
} from '@/lib/design-options';

// Valores derivados de la fuente única `design-options` (un solo sitio de verdad).
const ESTILOS = ESTILO_VALUES;
const ENTREGABLES = ENTREGABLE_VALUES;

export const QUALIFICATION_TOOLS: ToolDefinition[] = [
  {
    name: 'set_objetivo',
    description: 'Registra el objetivo del usuario para el espacio.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['objetivo'],
      properties: { objetivo: { type: 'string' } },
    },
  },
  {
    name: 'set_estilo',
    description: 'Registra el estilo elegido (valor de la lista permitida).',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['estilo'],
      properties: { estilo: { type: 'string', enum: [...ESTILOS] } },
    },
  },
  {
    name: 'set_entregables',
    description: 'Registra los tipos de entregable solicitados.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['entregables'],
      properties: {
        entregables: { type: 'array', items: { type: 'string', enum: [...ENTREGABLES] } },
      },
    },
  },
  {
    name: 'finalizar',
    description: 'Indica que los requisitos están completos y listos para entregar.',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
  },
];

// Re-exporta el validador de estilo de la fuente única (mismo comportamiento).
export const isValidEstilo = isValidEstiloShared;

export function parseEntregables(v: unknown): DeliverableType[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is DeliverableType => (ENTREGABLES as readonly string[]).includes(x as string));
}
