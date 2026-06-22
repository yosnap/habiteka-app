/**
 * Proveedor de imagen "Nano Banana" (Gemini 2.5 Flash Image) vía OpenRouter.
 *
 * Reutiliza el gateway de IA existente (una sola key `OPENROUTER_API_KEY`, mismo
 * punto de facturación y de control que el resto de IA). OpenRouter expone la
 * generación de imagen a través de Chat Completions con `modalities` y devuelve la
 * imagen como data URL base64 en `choices[0].message.images[]`.
 *
 * Para cumplir el contrato (`assetUrl`), el base64 se sube al object storage y se
 * devuelve su URL; sin storage configurado (p. ej. el spike sin MinIO) se devuelve
 * el data URL directamente, para no bloquear la generación.
 */
import type { ImageGenRequest, InpaintRequest, ImageResult } from '@/lib/contracts';
import type { ImageProvider } from './image-provider';
import type { StorageAdapter } from '@/server/storage/storage-adapter';
import { imageCost } from '../../cost/usage-to-cost';
import { aiError } from '../../errors';

// Coste por imagen (calibrable; la tarifa real la fija la fase de facturación a
// partir de mediciones reales del comparativo del spike).
const NANO_BANANA_USD_PER_IMAGE = 0.04;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-2.5-flash-image';

interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface OpenRouterImageResponse {
  choices?: Array<{
    message?: { images?: Array<{ image_url?: { url?: string } }> };
  }>;
}

export class NanoBananaImageProvider implements ImageProvider {
  readonly id = 'nano-banana';

  constructor(
    private readonly apiKey: string,
    private readonly storage?: StorageAdapter,
    // Slug del modelo de imagen en OpenRouter. Por defecto Gemini Flash Image; se
    // puede inyectar otro modelo del mismo canal (p. ej. FLUX) sin duplicar cliente.
    private readonly model: string = DEFAULT_MODEL,
  ) {}

  async generate(req: ImageGenRequest): Promise<ImageResult> {
    const content: ContentPart[] = [{ type: 'text', text: req.prompt }];
    if (req.referenceImage?.base64) {
      content.unshift({ type: 'image_url', image_url: { url: toDataUrl(req.referenceImage) } });
    }
    return this.call(content);
  }

  async inpaint(req: InpaintRequest): Promise<ImageResult> {
    if (!req.baseImage.base64 && !req.baseImage.url) {
      throw aiError('provider_down', 'Nano Banana requiere la imagen base para editar');
    }
    const content: ContentPart[] = [
      { type: 'image_url', image_url: { url: toDataUrl(req.baseImage) } },
      { type: 'text', text: req.prompt },
    ];
    return this.call(content);
  }

  private async call(content: ContentPart[]): Promise<ImageResult> {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        modalities: ['text', 'image'],
        messages: [{ role: 'user', content }],
      }),
    });
    if (!res.ok) {
      throw aiError('provider_down', `OpenRouter (${this.model}) respondió ${res.status}`);
    }
    const data = (await res.json()) as OpenRouterImageResponse;
    const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url) {
      throw aiError('provider_down', `OpenRouter (${this.model}) no devolvió imagen`);
    }

    const assetUrl = await this.persist(url);
    return { assetUrl, cost: imageCost(NANO_BANANA_USD_PER_IMAGE) };
  }

  /** Sube la imagen (data URL) al storage y devuelve su URL; sin storage, el data URL. */
  private async persist(dataUrl: string): Promise<string> {
    if (!this.storage || !dataUrl.startsWith('data:')) {
      return dataUrl;
    }
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return dataUrl;
    const ext = parsed.mimeType.includes('png') ? 'png' : 'jpg';
    const key = `renders/nano-banana/${globalThis.crypto.randomUUID()}.${ext}`;
    await this.storage.put({
      key,
      body: Buffer.from(parsed.base64, 'base64'),
      contentType: parsed.mimeType,
    });
    return this.storage.getPresignedDownloadUrl(key);
  }
}

/** Construye un data URL desde una referencia con base64 o devuelve su URL remota. */
function toDataUrl(ref: { url?: string; base64?: string; mimeType?: string }): string {
  if (ref.base64) return `data:${ref.mimeType ?? 'image/png'};base64,${ref.base64}`;
  return ref.url ?? '';
}

/** Extrae mimeType y base64 de un data URL. */
function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match || !match[1] || !match[2]) return null;
  return { mimeType: match[1], base64: match[2] };
}
