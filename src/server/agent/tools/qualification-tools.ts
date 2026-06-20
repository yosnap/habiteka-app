/**
 * Herramientas que el modelo invoca durante la cualificación para consolidar los
 * requisitos. El modelo no escribe `Collected` libremente: solo a través de estas
 * herramientas con valores acotados (el estilo y los entregables son enumerados),
 * de modo que el estado resultante siempre es válido.
 */
import type { ToolDefinition, Estilo, DeliverableType } from '@/lib/contracts';

export const ESTILOS: Estilo[] = [
  'minimalista',
  'moderno',
  'clasico',
  'industrial',
  'rustico',
  'mediterraneo',
  'nordico',
];

export const ENTREGABLES: DeliverableType[] = ['plano2d', 'render3d', 'memoria'];

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

export function isValidEstilo(v: unknown): v is Estilo {
  return typeof v === 'string' && (ESTILOS as string[]).includes(v);
}

export function parseEntregables(v: unknown): DeliverableType[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is DeliverableType => (ENTREGABLES as string[]).includes(x as string));
}
