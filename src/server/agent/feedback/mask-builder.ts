/**
 * Construye la zona de inpainting que espera el adaptador de imagen (F0/F3).
 *
 * El adaptador recibe una `CanvasZone` con su bbox normalizado y, opcionalmente,
 * la referencia a una máscara rasterizada. Aquí se compone esa zona a partir de
 * la región ya validada; la máscara concreta la materializa el proveedor a partir
 * del bbox. Mantener esto en `agent/feedback/` evita tocar el subárbol de F3.
 */
import type { CanvasZone, NormalizedBBox } from '@/lib/contracts';

export interface MaskInput {
  zoneId: string;
  box: NormalizedBBox;
  /** Referencia a una máscara ya rasterizada (si la UI la aportó). */
  maskRef?: string;
}

/** Compone la `CanvasZone` para `InpaintRequest` a partir de la región validada. */
export function buildInpaintZone(input: MaskInput): CanvasZone {
  return {
    id: input.zoneId,
    bbox: input.box,
    ...(input.maskRef ? { maskRef: input.maskRef } : {}),
  };
}
