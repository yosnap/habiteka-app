/**
 * Nombres en español de los puntos de control de calidad y su naturaleza.
 *
 * «Previo» = decide antes de gastar (puede ahorrar tokens); «posterior» = puntúa
 * un resultado ya generado y cobrado. Lo comparten el panel de eficacia y su
 * exportación para no describir dos veces lo mismo.
 */
export type CheckpointKind = 'previo' | 'posterior';

export const CHECKPOINT_LABELS: Record<string, string> = {
  plan_extraction: 'Fiabilidad del plano leído',
  editor_structure: 'Estructura del editor antes de generar',
  change_instruction: 'Instrucción de cambio',
  render_result: 'Render entregado',
  memoria_result: 'Memoria entregada',
  plan_result: 'Plano entregado',
  peticion_minima: 'Petición mínima',
};

/** Puertas previas: bloquear aquí evita el gasto de la generación siguiente. */
export const PRE_GATE_CHECKPOINTS = [
  'plan_extraction',
  'editor_structure',
  'change_instruction',
] as const;

export function checkpointLabel(checkpoint: string): string {
  return CHECKPOINT_LABELS[checkpoint] ?? checkpoint;
}

export function checkpointKind(checkpoint: string): CheckpointKind {
  return (PRE_GATE_CHECKPOINTS as readonly string[]).includes(checkpoint) ? 'previo' : 'posterior';
}
