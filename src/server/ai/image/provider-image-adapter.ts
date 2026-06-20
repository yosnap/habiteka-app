/**
 * Fachada de imagen que implementa el contrato de F0.
 *
 * Delega en el proveedor activo (seleccionado por `IMAGE_PROVIDER`) y aplica el
 * techo de dimensiones por request antes de tocar al proveedor. El proveedor se
 * puede inyectar para los tests (cero red).
 */
import type { ImageAdapter, ImageGenRequest, InpaintRequest, ImageResult } from '@/lib/contracts';
import type { ImageProvider } from './providers/image-provider';
import { FluxImageProvider } from './providers/flux';
import { NanoBananaImageProvider, ImagenImageProvider } from './providers/stubs';
import { assertImageDimensions } from '../call-limits';
import { aiError } from '../errors';

export class ProviderImageAdapter implements ImageAdapter {
  constructor(private readonly provider: ImageProvider) {}

  async generate(req: ImageGenRequest): Promise<ImageResult> {
    assertDimensionsFromAspect(req.aspectRatio);
    return this.provider.generate(req);
  }

  async inpaint(req: InpaintRequest): Promise<ImageResult> {
    return this.provider.inpaint(req);
  }
}

/** Crea el proveedor según `IMAGE_PROVIDER` (flux por defecto). */
export function createActiveProvider(): ImageProvider {
  const choice = process.env.IMAGE_PROVIDER ?? 'flux';
  switch (choice) {
    case 'flux': {
      const key = process.env.IMAGE_PROVIDER_KEY;
      if (!key) throw aiError('provider_down', 'IMAGE_PROVIDER_KEY no está definida');
      return new FluxImageProvider(key);
    }
    case 'nano-banana':
      return new NanoBananaImageProvider();
    case 'imagen':
      return new ImagenImageProvider();
    default:
      throw aiError('provider_down', `IMAGE_PROVIDER desconocido: ${choice}`);
  }
}

// Una relación de aspecto no fija dimensiones absolutas, pero si el cliente pide
// un tamaño concreto vía aspect se valida que no dispare el techo. Aquí solo se
// comprueban formatos `WxH` explícitos.
function assertDimensionsFromAspect(aspect?: string): void {
  if (!aspect) return;
  const match = /^(\d+)x(\d+)$/.exec(aspect);
  if (match) {
    assertImageDimensions(Number(match[1]), Number(match[2]));
  }
}
