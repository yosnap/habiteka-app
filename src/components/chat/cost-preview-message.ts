/**
 * Texto del preview de coste antes de una acción generadora.
 *
 * El frontend NO decide si algo es gratis: refleja los valores que aporta la
 * facturación (`freeIterationsRemaining` y `estimateCost`). Esta función pura
 * traduce esos valores al mensaje que ve el usuario, de modo que la regla de
 * presentación quede testeable sin montar la UI.
 */

export interface CostInputs {
  /** true si es un entregable nuevo; false si es una iteración de uno existente. */
  isNewDeliverable: boolean;
  /** Iteraciones gratis que quedan para este entregable (de la facturación). */
  freeIterationsRemaining: number;
  /** Total de iteraciones gratis por entregable (de la facturación). */
  freeIterationsTotal: number;
  /** Coste estimado en créditos si se cobra (de la facturación). */
  estimateCredits: number;
}

export interface CostPreview {
  free: boolean;
  message: string;
}

export function costPreviewMessage(input: CostInputs): CostPreview {
  // Un entregable nuevo siempre sale del saldo (el cupo de bienvenida es saldo
  // finito, no un "gratis por proyecto").
  if (input.isNewDeliverable) {
    return { free: false, message: `~${input.estimateCredits} créditos · confirmar` };
  }
  // Iteración con cupo gratis restante.
  if (input.freeIterationsRemaining > 0) {
    const remaining = input.freeIterationsRemaining;
    const total = input.freeIterationsTotal;
    return { free: true, message: `Gratis · te quedan ${remaining} de ${total} ajustes` };
  }
  // Iteración con el cupo agotado.
  return { free: false, message: `~${input.estimateCredits} créditos · confirmar` };
}
