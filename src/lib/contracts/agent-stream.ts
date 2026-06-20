/**
 * Eventos del streaming del chat del agente (servidor → hook de UI).
 *
 * Unión discriminada por `type`. La distinción clave es la visibilidad de las
 * tool-calls: algunas herramientas son internas del orquestador y NO deben
 * mostrarse al usuario; el flag `visible` deja esa decisión en el contrato, no
 * en la UI.
 */
import type { AgentPhase } from './agent-state';

export type AgentStreamEvent =
  | { type: 'text-delta'; text: string }
  | {
      type: 'tool-call';
      name: string;
      /** Si la herramienta debe exponerse al usuario en la UI. */
      visible: boolean;
    }
  | { type: 'phase'; phase: AgentPhase }
  | { type: 'error'; message: string; code?: string }
  | { type: 'done' };
