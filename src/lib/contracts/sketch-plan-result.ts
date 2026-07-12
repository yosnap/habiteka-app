/**
 * Resultado de convertir un boceto en plano métrico. La geometría siempre está
 * en milímetros (el motor lo exige), pero la escala puede ser una CONJETURA:
 * si el boceto no traía medidas escritas, las cotas derivadas no son datos del
 * usuario y la UI no debe presentarlas como medidas reales.
 */
import type { Plano2dPayload } from './plano2d-payload';

export interface SketchPlanResult {
  plano: Plano2dPayload;
  /**
   * True si la escala es estimada (el boceto no traía cotas ni medidas
   * escritas). La UI debe ocultar cotas/superficies o pedir el ancho real.
   */
  escalaEstimada: boolean;
}
