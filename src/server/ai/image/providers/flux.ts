/**
 * Proveedor de imagen FLUX (vía OpenRouter / gateway de imagen).
 *
 * Implementación mínima del contrato de proveedor: llama al endpoint de
 * generación, sube el resultado como asset y devuelve su URL y coste. El coste se
 * factura por imagen (no por tokens). La clave es server-only.
 */
import type { ImageGenRequest, InpaintRequest, ImageResult } from '@/lib/contracts';
import type { ImageProvider } from './image-provider';
import { imageCost } from '../../cost/usage-to-cost';
import { aiError } from '../../errors';

// Coste por imagen del proveedor (placeholder calibrable; la tarifa real la fija
// la fase de facturación a partir de mediciones).
const FLUX_USD_PER_IMAGE = 0.04;

export class FluxImageProvider implements ImageProvider {
  readonly id = 'flux';

  constructor(
    private readonly apiKey: string,
    private readonly endpoint = 'https://api.bfl.ml/v1/flux',
  ) {}

  async generate(req: ImageGenRequest): Promise<ImageResult> {
    return this.call({ prompt: req.prompt, aspectRatio: req.aspectRatio, seed: req.seed });
  }

  async inpaint(req: InpaintRequest): Promise<ImageResult> {
    return this.call({ prompt: req.prompt, seed: req.seed, inpaint: true });
  }

  private async call(payload: Record<string, unknown>): Promise<ImageResult> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw aiError('provider_down', `FLUX respondió ${res.status}`);
    }
    const data = (await res.json()) as { url?: string };
    if (!data.url) {
      throw aiError('provider_down', 'FLUX no devolvió una URL de asset');
    }
    return { assetUrl: data.url, cost: imageCost(FLUX_USD_PER_IMAGE) };
  }
}
