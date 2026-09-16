import OpenAI, { toFile } from 'openai';
import type { ImageGenRequest, ImageResult, InpaintRequest } from '@/lib/contracts';
import type { StorageAdapter } from '@/server/storage/storage-adapter';
import { aiError } from '../../errors';
import { imageCost } from '../../cost/usage-to-cost';
import type { ImageProvider } from './image-provider';

/** Adaptador directo de GPT Image: evita límites y transformaciones de proxies. */
export class OpenAiImageProvider implements ImageProvider {
  readonly id = 'openai';
  constructor(
    apiKey: string,
    private readonly storage: StorageAdapter | undefined,
    private readonly model: 'gpt-image-2' = 'gpt-image-2',
  ) {
    this.client = new OpenAI({ apiKey });
  }

  private readonly client: OpenAI;

  async generate(request: ImageGenRequest): Promise<ImageResult> {
    const references = request.referenceImages ?? (request.referenceImage ? [request.referenceImage] : []);
    try {
      const response = references.length
        ? await this.client.images.edit({
          model: this.model as never,
          image: await this.files(references),
          prompt: request.prompt,
          size: sizeForAspect(request.aspectRatio),
          quality: 'high',
          output_format: 'png',
        } as never)
        : await this.client.images.generate({
          model: this.model as never,
          prompt: request.prompt,
          size: sizeForAspect(request.aspectRatio),
          quality: 'high',
          output_format: 'png',
        } as never);
      return this.result(response.data?.[0]?.b64_json);
    } catch (error) {
      throw aiError('provider_down', 'OpenAI no pudo generar el render.', error);
    }
  }

  async inpaint(request: InpaintRequest): Promise<ImageResult> {
    try {
      const response = await this.client.images.edit({
        model: this.model as never,
        image: await this.files([request.baseImage]),
        prompt: request.prompt,
        quality: 'high',
        output_format: 'png',
      } as never);
      return this.result(response.data?.[0]?.b64_json);
    } catch (error) {
      throw aiError('provider_down', 'OpenAI no pudo editar el render.', error);
    }
  }

  private async files(references: Array<{ base64?: string; mimeType?: string; url?: string }>) {
    return Promise.all(references.map(async (reference, index) => {
      if (!reference.base64) throw aiError('provider_down', 'OpenAI necesita referencias locales en este flujo.');
      const mimeType = reference.mimeType ?? 'image/png';
      return toFile(Buffer.from(reference.base64, 'base64'), `referencia-${index + 1}.${mimeType.includes('png') ? 'png' : 'jpg'}`, { type: mimeType });
    }));
  }

  private async result(base64: string | undefined): Promise<ImageResult> {
    if (!base64) throw aiError('provider_down', 'OpenAI no devolvió una imagen.');
    const dataUrl = `data:image/png;base64,${base64}`;
    if (!this.storage) return { assetUrl: dataUrl, cost: imageCost(0.15) };
    try {
      const key = `renders/openai/${globalThis.crypto.randomUUID()}.png`;
      await this.storage.put({ key, body: Buffer.from(base64, 'base64'), contentType: 'image/png' });
      return { assetKey: key, assetUrl: await this.storage.getPresignedDownloadUrl(key), cost: imageCost(0.15) };
    } catch {
      return { assetUrl: dataUrl, cost: imageCost(0.15) };
    }
  }
}

function sizeForAspect(aspect?: string): '1024x1024' | '1536x1024' | '1024x1536' {
  if (!aspect) return '1536x1024';
  const [width = 1, height = 1] = aspect.split(':').map(Number);
  return width > height ? '1536x1024' : height > width ? '1024x1536' : '1024x1024';
}
