/**
 * Marca de puerta dentro de la fila de una evaluación.
 *
 * Una evaluación por sí sola no dice si cortó gasto: el mismo punto de control
 * se usa para informar (una tarjeta en la UI) y para decidir antes de pagar. La
 * marca viaja dentro del JSON `answers` —no hace falta migración— y responde a
 * dos preguntas del panel de eficacia:
 *
 *  - `gate: 'cut'`: esta decisión CORTÓ una generación de pago concreta
 *    (`action`). Solo estas cuentan como ahorro.
 *  - `gate: 'passed'`: la puerta dejó pasar esa acción.
 *  - `gate: 'info'`: evaluación informativa; no había gasto que cortar.
 *  - `reused: true`: la decisión salió de la caché por evidencia, sin llamar a
 *    Jev ni pagar tokens. Es un paso de puerta más, pero de coste cero.
 *
 * Sin marca, la evaluación también es informativa (filas anteriores a esta
 * política): el panel las trata igual que `info`.
 */

/** Clave reservada dentro de `answers`; ninguna pregunta de Jev se llama así. */
export const GATE_MARK_KEY = '_gate';

export interface GateMark {
  /** `info` = evaluación informativa (sin acción de pago detrás). */
  gate: 'cut' | 'passed' | 'info';
  /** Acción de pago que la puerta protegía (p. ej. `cenital_studio`). */
  action: string;
  /** `true` si la decisión se reutilizó de la caché por evidencia (coste 0). */
  reused?: boolean;
}

/** Acción de pago que protege una puerta; sin ella, la evaluación es informativa. */
export interface GateContext {
  action: string;
}

/** Inserta la marca en las respuestas que se guardan (no toca las de Jev). */
export function withGateMark(
  answers: Record<string, unknown>,
  mark: GateMark | null,
): Record<string, unknown> {
  if (!mark) return answers;
  return { ...answers, [GATE_MARK_KEY]: mark };
}

/** Lee la marca de una fila guardada; `null` si la evaluación era informativa. */
export function readGateMark(answers: unknown): GateMark | null {
  if (!answers || typeof answers !== 'object') return null;
  const raw = (answers as Record<string, unknown>)[GATE_MARK_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const { gate, action, reused } = raw as Record<string, unknown>;
  if (gate !== 'cut' && gate !== 'passed' && gate !== 'info') return null;
  return {
    gate,
    action: typeof action === 'string' ? action : 'desconocida',
    ...(reused === true ? { reused: true } : {}),
  };
}
