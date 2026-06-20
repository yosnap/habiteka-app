/**
 * Elemento de diseño referenciable de forma estable entre versiones del
 * entregable.
 *
 * `targetRef` es la clave que NO cambia al regenerar una zona: permite apuntar
 * al mismo elemento (una puerta, un azulejo, un color) a través de iteraciones
 * para la votación comunitaria y el marketplace, aunque su representación
 * gráfica se haya regenerado.
 */

export type DesignElementKind =
  | 'puerta'
  | 'ventana'
  | 'pared'
  | 'suelo'
  | 'azulejo'
  | 'color'
  | 'mobiliario'
  | 'iluminacion';

export interface DesignElement {
  id: string;
  kind: DesignElementKind;
  /**
   * Referencia estable al objetivo dentro del entregable (p. ej. el id de una
   * zona/pared del plano 2D). Invariante entre regeneraciones de esa zona.
   */
  targetRef: string;
  /** Etiqueta legible para el usuario (votación/marketplace). */
  label?: string;
}
