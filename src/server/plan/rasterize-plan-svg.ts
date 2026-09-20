/**
 * Rasteriza el plano técnico (SVG determinista de `plan-svg`) a PNG en el
 * servidor, como imagen de CONDICIONAMIENTO del render cenital (F3): el modelo
 * de imagen recibe el plano como imagen, no como descripción textual — la
 * lección del pipeline anterior, donde el modelo inventaba la disposición.
 *
 * Sin textos ni cotas: el modelo copia literalmente las etiquetas al render
 * (mismo motivo que en `rasterize-canvas-doc`). Solo geometría.
 */
import sharp from 'sharp';
import type { Plano2dPayload } from '@/lib/contracts';
import { planoToSvg } from '@/lib/plan-svg/geometry-to-svg';
import { toAspectRatio } from '@/server/agent/canvas/rasterize-canvas-doc';

// Resolución del raster de referencia: suficiente detalle sin inflar el payload
// base64 que viaja al proveedor.
const RASTER_PX_PER_METER = 110;

export interface PlanRasterResult {
  /** PNG en base64 (sin prefijo `data:`). */
  base64: string;
  /** Proporción canónica del plano ('16:9', '4:3'…), para pedirla al proveedor. */
  aspectRatio: string;
}

/** Rasteriza el plano (solo geometría) y devuelve el PNG con su proporción. */
export async function rasterizePlano(plano: Plano2dPayload): Promise<PlanRasterResult> {
  const svg = planoToSvg(plano, {
    pxPerMeter: RASTER_PX_PER_METER,
    showDimensions: false,
    showLabels: false,
  });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const meta = await sharp(png).metadata();
  return {
    base64: png.toString('base64'),
    aspectRatio: toAspectRatio(meta.width ?? 1, meta.height ?? 1),
  };
}
