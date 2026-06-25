/**
 * Adaptador de imagen: generación (render 3D) e inpainting (feedback por zona).
 *
 * Pieza enchufable que desacopla el agente del proveedor concreto
 * (FLUX / Nano Banana / Imagen): el proveedor se decide por spike comparativo
 * y queda conmutable por configuración. Los tipos son propios y serializables.
 */
import type { CanvasZone } from './canvas-zone';
import type { ProviderCost } from './credits';

export interface ImageGenRequest {
  prompt: string;
  /** Imagen de referencia (URL o base64) para condicionar el render. */
  referenceImage?: { url?: string; base64?: string; mimeType?: string };
  /** Relación de aspecto deseada (p. ej. '16:9', '1:1'). */
  aspectRatio?: string;
  /** Semilla para reproducibilidad cuando el proveedor la soporta. */
  seed?: number;
}

export interface InpaintRequest {
  /** Imagen base sobre la que se regenera una región. */
  baseImage: { url?: string; base64?: string; mimeType?: string };
  /** Zona a regenerar; su máscara delimita la región afectada. */
  zone: CanvasZone;
  prompt: string;
  seed?: number;
}

export interface ImageResult {
  /** URL del asset generado (presigned o pública según el storage). */
  assetUrl: string;
  /**
   * Clave estable del asset en el object storage propio, si vive ahí. Permite
   * re-firmar una URL fresca al mostrar (la presignada de `assetUrl` caduca).
   * Ausente si el proveedor devuelve una URL remota/pública o un data URL.
   */
  assetKey?: string;
  cost: ProviderCost;
}

export interface ImageAdapter {
  generate(req: ImageGenRequest): Promise<ImageResult>;
  inpaint(req: InpaintRequest): Promise<ImageResult>;
}
