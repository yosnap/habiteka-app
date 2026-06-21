/**
 * Stub del proveedor de imagen Imagen (Google).
 *
 * No se implementa como cliente real: Imagen requiere GCP project + OAuth/Vertex
 * AI (no una API key simple), no expone inpainting REST claro y Google lo deprecó
 * con migración a Gemini 2.5 Flash Image ("Nano Banana"), que sí está implementado.
 * Por eso, si se selecciona, falla de forma explícita con la razón, en lugar de
 * quedar como un hueco silencioso.
 */
import type { ImageResult } from '@/lib/contracts';
import type { ImageProvider } from './image-provider';
import { aiError } from '../../errors';

const REASON =
  'Imagen no está disponible: requiere Vertex AI/OAuth y está en deprecación. Usa nano-banana o flux.';

export class ImagenImageProvider implements ImageProvider {
  readonly id = 'imagen';

  generate(): Promise<ImageResult> {
    return Promise.reject(aiError('provider_down', REASON));
  }

  inpaint(): Promise<ImageResult> {
    return Promise.reject(aiError('provider_down', REASON));
  }
}
