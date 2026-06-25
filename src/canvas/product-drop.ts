/**
 * Materialización de un drop del marketplace en un objeto del canvas.
 *
 * La UI de marketplace emite un `ProductDrop` (contrato F0); el canvas lo
 * convierte en un `ProductRef` con su propia identidad para gestionarlo como un
 * objeto más del documento. Lógica pura (sin Konva), testeable de forma aislada.
 */
import type { ProductDrop } from '@/lib/contracts';
import type { ProductRef } from './types';

/** Crea un `ProductRef` a partir de un drop. El `id` lo provee quien llama
 *  (generador estable fuera de esta función para mantenerla pura). */
export function productDropToRef(drop: ProductDrop, id: string): ProductRef {
  return {
    id,
    marketplaceItemId: drop.marketplaceItemId,
    x: drop.stageX,
    y: drop.stageY,
    ...(drop.targetRef ? { targetRef: drop.targetRef } : {}),
  };
}
