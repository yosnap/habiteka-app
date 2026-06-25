'use client';

/**
 * Prepara el arrastre de un producto del catálogo hacia el canvas. El add-on solo
 * EMITE el payload del producto (contrato `ProductDrop` de F0) en el evento de
 * arrastre; el canvas (F4) lo recibe y lo coloca. Así no se reimplementa el canvas
 * ni se cruza una frontera frágil: el contrato compartido es la interfaz.
 */
import type { DragEvent } from 'react';
import type { ProductDrop } from '@/lib/contracts';

const DRAG_MIME = 'application/x-habiteka-product';

/** Adjunta al evento de arrastre el payload del producto (sin posición todavía). */
export function onProductDragStart(event: DragEvent, marketplaceItemId: string): void {
  const payload: Pick<ProductDrop, 'marketplaceItemId'> = { marketplaceItemId };
  event.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = 'copy';
}

/** Lee el payload del producto desde un evento de drop (lo consume el canvas). */
export function readProductDrop(
  event: DragEvent,
  stageX: number,
  stageY: number,
): ProductDrop | null {
  const raw = event.dataTransfer.getData(DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { marketplaceItemId?: string };
    if (!parsed.marketplaceItemId) return null;
    return { marketplaceItemId: parsed.marketplaceItemId, stageX, stageY };
  } catch {
    return null;
  }
}

export { DRAG_MIME };
