/**
 * Payload del drop de un producto del marketplace sobre el canvas (FE → FE).
 *
 * Lo emite la UI del marketplace al soltar un ítem y lo consume el canvas para
 * colocarlo. `stageX`/`stageY` son coordenadas del stage de Konva; `targetRef`
 * (opcional) ata el producto a un elemento de diseño estable cuando se suelta
 * sobre uno concreto.
 */
export interface ProductDrop {
  marketplaceItemId: string;
  /** Coordenada X en el stage del canvas (px del stage de Konva). */
  stageX: number;
  /** Coordenada Y en el stage del canvas (px del stage de Konva). */
  stageY: number;
  /** Elemento de diseño al que se asocia el producto, si aplica. */
  targetRef?: string;
}
