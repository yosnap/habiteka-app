import type { EditorDocument } from '@/lib/editor-document/schema';
import type { RenderView } from '@/lib/editor-document/render-view';
import { isInteriorRenderMode, zoneCompositeActive, type RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { sanitizeImageBuffer } from '@/server/ai/image/input-sanitizer';
import { rasterizeEditorDocument } from './rasterize-editor-document';
import { rasterizeEditorElevation, sectionRooms, type ElevationSide } from './rasterize-editor-elevation';

/**
 * Dibujos 2D que sustituyen a la captura 3D en las vistas de toda la planta: el plano para la cenital y la sección
 * abierta para los alzados con cenital aceptada. El generador respeta mejor un dibujo con la misma perspectiva que el
 * resultado que una maqueta en perspectiva; zonas, interiores y revisiones de imagen existente siguen con la captura.
 */
export async function renderDrawingReferences(document: EditorDocument, view: RenderView, options: RenderDesignOptions,
  acceptedTop: boolean, reviewingExisting: boolean) {
  if (zoneCompositeActive(options) || isInteriorRenderMode(options) || reviewingExisting) return {};
  if (view.preset === 'top') {
    // Solo las hojas: el arco de giro salía en la imagen como un tablón curvo entre los marcos.
    const raster = await rasterizeEditorDocument(document, undefined, { doorLeaves: true, swingArcs: false });
    return { plan: await sanitizeImageBuffer(Buffer.from(raster.base64, 'base64')) };
  }
  if (!acceptedTop || !['front', 'back', 'left', 'right'].includes(view.preset)) return {};
  // La arquitectura viene del plano; el mobiliario procede de la imagen aceptada, que puede haber sido rediseñada.
  const side = view.preset as ElevationSide, image = await rasterizeEditorElevation(document, side, { cut: true, furniture: false });
  return image ? { section: { image: await sanitizeImageBuffer(Buffer.from(image.base64, 'base64')), rooms: sectionRooms(document, side) } } : {};
}
