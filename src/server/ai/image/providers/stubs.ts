/**
 * Stubs tipados de los proveedores de imagen aún no implementados.
 *
 * El spike de calidad comparará FLUX / Nano Banana / Imagen y decidirá cuál se
 * adopta. Hasta entonces estos cumplen el contrato pero fallan de forma explícita
 * si se seleccionan, en lugar de quedar como huecos silenciosos.
 */
import type { ImageResult } from '@/lib/contracts';
import type { ImageProvider } from './image-provider';
import { aiError } from '../../errors';

class UnimplementedProvider implements ImageProvider {
  constructor(readonly id: string) {}

  generate(): Promise<ImageResult> {
    return Promise.reject(
      aiError('provider_down', `Proveedor de imagen no implementado: ${this.id}`),
    );
  }

  inpaint(): Promise<ImageResult> {
    return Promise.reject(
      aiError('provider_down', `Proveedor de imagen no implementado: ${this.id}`),
    );
  }
}

export class NanoBananaImageProvider extends UnimplementedProvider {
  constructor() {
    super('nano-banana');
  }
}

export class ImagenImageProvider extends UnimplementedProvider {
  constructor() {
    super('imagen');
  }
}
