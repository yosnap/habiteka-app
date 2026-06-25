/**
 * Contrato interno de un proveedor de imagen concreto.
 *
 * La fachada `ProviderImageAdapter` delega en la implementación activa
 * (seleccionada por `IMAGE_PROVIDER`). Separar el contrato del proveedor permite
 * tener un proveedor real y los demás como stubs tipados hasta que el spike de
 * calidad decida cuál se adopta.
 */
import type { ImageGenRequest, InpaintRequest, ImageResult } from '@/lib/contracts';

export interface ImageProvider {
  readonly id: string;
  generate(req: ImageGenRequest): Promise<ImageResult>;
  inpaint(req: InpaintRequest): Promise<ImageResult>;
}
