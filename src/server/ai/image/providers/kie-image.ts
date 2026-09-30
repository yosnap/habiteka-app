/** Cliente KIE de imágenes basado en tareas asíncronas. */
import type { ImageGenRequest, InpaintRequest, ImageResult } from '@/lib/contracts';
import type { StorageAdapter } from '@/server/storage/storage-adapter';
import type { ImageProvider } from './image-provider';
import { imageCost } from '../../cost/usage-to-cost';
import { AiError, aiError } from '../../errors';
import { MAX_OWN_RENDER_BYTES } from '../input-sanitizer';

const CREATE_TASK_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
const TASK_URL = 'https://api.kie.ai/api/v1/jobs/recordInfo';
const BASE64_UPLOAD_URL = 'https://kieai.redpandaai.co/api/file-base64-upload';
const POLL_INTERVAL_MS = 3_000;
const TIMEOUT_MS = 120_000;
const FLUX_TIMEOUT_MS = 600_000;
// Los PNG 4K de gpt-image pasan de 12 MB: el tope es el mismo que admite el lector de renders propios.
const MAX_REMOTE_IMAGE_BYTES = MAX_OWN_RENDER_BYTES;
/** La CDN de KIE entrega imágenes de varios MB y a veces tarda: un corte a 30 s perdía imágenes ya cobradas. */
const RESULT_DOWNLOAD_TIMEOUT_MS = 120_000;
const RESULT_DOWNLOAD_ATTEMPTS = 2;

interface KieProviderOptions {
  pollIntervalMs?: number;
  timeoutMs?: number;
  /** Tiempo por intento de descarga del resultado; en pruebas se acorta. */
  resultDownloadTimeoutMs?: number;
}

interface TaskResponse {
  code?: number;
  msg?: string;
  data?: {
    taskId?: string;
    state?: 'waiting' | 'queuing' | 'generating' | 'success' | 'fail';
    resultJson?: string;
    failMsg?: string;
    successFlag?: number;
    errorMessage?: string;
    response?: { result_urls?: string[] };
  };
}
interface UploadResponse {
  success?: boolean;
  code?: number;
  msg?: string;
  data?: { downloadUrl?: string; fileUrl?: string };
}

/** Modelos KIE que comparten el contrato `jobs/createTask` e imagen de entrada URL. */
export const KIE_UNIFIED_IMAGE_MODELS = new Set([
  'google/nano-banana',
  'nano-banana-pro',
  'nano-banana-2',
  'nano-banana-2-lite',
  'flux-2/pro-image-to-image',
  'flux-2/flex-image-to-image',
  'gpt-image-2-5-sunburst-image-to-image',
  'gpt-image-2-5-flare-image-to-image',
]);

/** FLUX.2 usa `input_urls`, a diferencia de la familia Nano Banana. */
const KIE_FLUX_2_IMAGE_MODELS = new Set([
  'flux-2/pro-image-to-image',
  'flux-2/flex-image-to-image',
]);

/** GPT Image 2.5 también recibe referencias como URLs, pero ofrece salida 4K. */
const KIE_GPT_IMAGE_2_5_MODELS = new Set([
  'gpt-image-2-5-sunburst-image-to-image',
  'gpt-image-2-5-flare-image-to-image',
]);

export class KieImageProvider implements ImageProvider {
  readonly id = 'kie';

  constructor(
    private readonly apiKey: string,
    private readonly storage: StorageAdapter | undefined,
    private readonly model: string,
    private readonly options: KieProviderOptions = {},
  ) {
    if (!KIE_UNIFIED_IMAGE_MODELS.has(model))
      throw aiError('provider_down', `El modelo KIE ${model} aún no está conectado`);
  }

  async generate(req: ImageGenRequest): Promise<ImageResult> {
    const prompt = this.validatedPrompt(req.prompt, req.compactPrompt);
    const references = req.referenceImages ?? (req.referenceImage ? [req.referenceImage] : []);
    const sources = await Promise.all(
      references.map((reference) => this.toKieReference(reference)),
    );
    return this.createAndWait(
      prompt,
      req.aspectRatio,
      sources.filter((source): source is string => Boolean(source)),
    );
  }

  async inpaint(req: InpaintRequest): Promise<ImageResult> {
    const prompt = this.validatedPrompt(req.prompt);
    const source = await this.toPublicUrl(req.baseImage);
    return this.createAndWait(prompt, undefined, [source]);
  }

  private validatedPrompt(full: string, compact?: string): string {
    const limit = KIE_FLUX_2_IMAGE_MODELS.has(this.model) ? 5000 : this.model === 'nano-banana-pro' ? 10000 : undefined;
    if (!limit) return full;
    const prompt = full.length > limit && compact ? compact : full;
    if (prompt.length > limit) throw Object.assign(aiError('provider_down',
      `${this.model} admite ${limit} caracteres; el contexto requiere ${prompt.length}. No se recortan medidas ni restricciones. Usa un modelo con más capacidad.`),
    { code: 'kie_prompt_too_long' });
    return prompt;
  }

  /** KIE ofrece carga temporal base64: no dependemos de que el S3 local sea público. */
  private async toKieReference(reference: {
    base64?: string;
    mimeType?: string;
    url?: string;
  }): Promise<string | undefined> {
    try {
      if (reference.url?.startsWith('https://')) return reference.url;
      if (!reference.base64) return this.toPublicUrl(reference);
      const mimeType = reference.mimeType ?? 'image/png';
      const extension = mimeType.includes('png') ? 'png' : 'jpg';
      const response = await fetch(BASE64_UPLOAD_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data: `data:${mimeType};base64,${reference.base64}`,
          uploadPath: 'images/habiteka',
          fileName: `plan-${globalThis.crypto.randomUUID()}.${extension}`,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const payload = (await response.json().catch(() => ({}))) as UploadResponse;
      const url = payload.data?.downloadUrl ?? payload.data?.fileUrl;
      if (!response.ok || payload.success === false || !url?.startsWith('https://')) {
        const reason = payload.msg ?? String(response.status);
        if (/free users can upload up to/i.test(reason)) {
          throw aiError(
            'provider_down',
            'KIE ha agotado la cuota gratuita de 30 subidas en 30 días. Añade saldo o usa una clave con cuota disponible.',
          );
        }
        throw aiError(
          'provider_down',
          `KIE no pudo preparar la referencia: ${reason}`,
        );
      }
      return url;
    } catch (error) {
      if (error instanceof AiError) throw error;
      throw aiError('provider_down', 'KIE no pudo subir la referencia del plano.', error);
    }
  }

  private async createAndWait(
    prompt: string,
    aspectRatio?: string,
    imageUrls: string[] = [],
  ): Promise<ImageResult> {
    const usesReferenceUrls =
      KIE_FLUX_2_IMAGE_MODELS.has(this.model) || KIE_GPT_IMAGE_2_5_MODELS.has(this.model);
    const isGptImage = KIE_GPT_IMAGE_2_5_MODELS.has(this.model);
    const input = usesReferenceUrls
      ? {
          prompt,
          input_urls: imageUrls,
          aspect_ratio: aspectRatio ? normalizeAspectRatio(aspectRatio) : 'auto',
          resolution: isGptImage ? '4K' : '1K',
          ...(KIE_FLUX_2_IMAGE_MODELS.has(this.model) ? { nsfw_checker: false } : {}),
        }
      : {
          prompt,
          ...(imageUrls.length ? { image_input: imageUrls } : {}),
          ...(aspectRatio ? { aspect_ratio: normalizeAspectRatio(aspectRatio) } : {}),
          output_format: 'png',
          resolution: '1K',
        };
    const response = await this.request(CREATE_TASK_URL, {
      model: this.model,
      input,
    });
    const taskId = response.data?.taskId;
    if (!taskId)
      throw aiError(
        'provider_down',
        `KIE no aceptó la tarea: ${response.msg ?? 'sin identificador'}`,
      );
    let resultUrl: string;
    try { resultUrl = await this.waitForImage(taskId); }
    catch (error) {
      if ((error as { code?: string }).code === 'kie_task_failed') throw error;
      // Una tarea aceptada puede seguir consumiendo créditos: nunca relanzarla
      // automáticamente con otro modelo por un fallo de consulta o timeout.
      throw Object.assign(aiError('timeout', `KIE aceptó la tarea ${taskId}, pero no se ha podido recuperar el resultado. No se ha lanzado otra generación.`, error),
        { code: 'kie_task_pending', providerTaskId: taskId });
    }
    const persisted = await this.persistResult(resultUrl);
    return { ...persisted, cost: imageCost(0.04) };
  }

  private async waitForImage(taskId: string): Promise<string> {
    // Los modelos GPT 2.5 entregan imágenes 4K y pueden superar dos minutos;
    // cortar antes deja la tarea cobrada sin imagen ni auditoría de fidelidad.
    const slowModel = KIE_FLUX_2_IMAGE_MODELS.has(this.model) || KIE_GPT_IMAGE_2_5_MODELS.has(this.model);
    const expiresAt = Date.now() + (this.options.timeoutMs ?? (slowModel ? FLUX_TIMEOUT_MS : TIMEOUT_MS));
    while (Date.now() < expiresAt) {
      await wait(this.options.pollIntervalMs ?? POLL_INTERVAL_MS);
      const response = await this.request(`${TASK_URL}?taskId=${encodeURIComponent(taskId)}`);
      const task = response.data;
      // Market jobs use state/resultJson, NOT the legacy 4o successFlag contract.
      if (task?.state === 'fail') throw Object.assign(aiError('provider_down', `KIE no pudo generar la imagen: ${task.failMsg ?? 'tarea fallida'}`), { code: 'kie_task_failed', providerTaskId: taskId });
      if (task?.state === 'success') {
        let result: unknown;
        try { result = JSON.parse(task.resultJson ?? ''); }
        catch { throw aiError('provider_down', 'KIE completó la tarea sin un resultado JSON válido.'); }
        const urls = result && typeof result === 'object' && 'resultUrls' in result ? result.resultUrls : null;
        const url = Array.isArray(urls) ? urls[0] : null;
        if (typeof url !== 'string' || !url.startsWith('https://')) throw aiError('provider_down', 'KIE completó la tarea sin una URL de imagen válida.');
        return url;
      }
      const status = response.data?.successFlag;
      const resultUrl = response.data?.response?.result_urls?.[0];
      if (status === 1 && resultUrl) return resultUrl;
      if (status === 2)
        throw Object.assign(aiError(
          'provider_down',
          `KIE no pudo generar la imagen: ${response.data?.errorMessage ?? 'tarea fallida'}`,
        ), { code: 'kie_task_failed', providerTaskId: taskId });
    }
    throw aiError('provider_down', 'KIE tardó demasiado en generar la imagen. Inténtalo de nuevo.');
  }

  private async request(url: string, body?: unknown): Promise<TaskResponse> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw aiError('provider_down', 'No se pudo contactar con KIE', error);
    }
    const payload = (await response.json().catch(() => ({}))) as TaskResponse;
    if (!response.ok || (payload.code && payload.code !== 200)) {
      throw Object.assign(aiError(
        'provider_down',
        `KIE respondió ${response.status}: ${payload.msg ?? 'error desconocido'}`,
      ), { code: /prompt.*(maximum|length)/i.test(payload.msg ?? '') ? 'kie_prompt_too_long' : `kie_http_${response.status}_api_${payload.code ?? 'unknown'}` });
    }
    return payload;
  }

  private async toPublicUrl(image: {
    base64?: string;
    mimeType?: string;
    url?: string;
  }): Promise<string> {
    if (image.url?.startsWith('https://')) return image.url;
    if (!image.base64 || !this.storage) {
      throw aiError(
        'provider_down',
        'KIE necesita una URL pública de imagen; configura STORAGE_* para usar referencias locales.',
      );
    }
    const mimeType = image.mimeType ?? 'image/png';
    const extension = mimeType.includes('png') ? 'png' : 'jpg';
    const key = `kie-inputs/${globalThis.crypto.randomUUID()}.${extension}`;
    await this.storage.put({
      key,
      body: Buffer.from(image.base64, 'base64'),
      contentType: mimeType,
    });
    const url = await this.storage.getPresignedDownloadUrl(key);
    if (!url.startsWith('https://')) {
      throw aiError(
        'provider_down',
        'KIE necesita un STORAGE_* público con HTTPS para leer la imagen de referencia.',
      );
    }
    return url;
  }

  private async persistResult(resultUrl: string): Promise<{ assetUrl: string; assetKey?: string }> {
    if (!this.storage) return { assetUrl: resultUrl };
    try {
      const { bytes, contentType } = await this.downloadResult(resultUrl);
      const extension = contentType.includes('png') ? 'png' : 'jpg';
      const key = `renders/kie/${globalThis.crypto.randomUUID()}.${extension}`;
      await this.storage.put({ key, body: bytes, contentType });
      return { assetUrl: await this.storage.getPresignedDownloadUrl(key), assetKey: key };
    } catch (error) {
      console.warn(
        '[kie] Falló la persistencia del resultado; se devuelve la URL temporal.',
        error,
      );
      return { assetUrl: resultUrl };
    }
  }

  /** La imagen ya está generada y cobrada: una descarga lenta se reintenta antes de darla por perdida. */
  private async downloadResult(resultUrl: string): Promise<{ bytes: Buffer; contentType: string }> {
    let lastError: unknown;
    for (let attempt = 0; attempt < RESULT_DOWNLOAD_ATTEMPTS; attempt++) {
      try {
        const result = await fetch(resultUrl, { signal: AbortSignal.timeout(this.options.resultDownloadTimeoutMs ?? RESULT_DOWNLOAD_TIMEOUT_MS) });
        if (!result.ok) throw new Error(`KIE image ${result.status}`);
        const bytes = Buffer.from(await result.arrayBuffer());
        if (bytes.byteLength > MAX_REMOTE_IMAGE_BYTES) throw new Error('Resultado de KIE demasiado grande');
        return { bytes, contentType: result.headers.get('content-type')?.split(';')[0] || 'image/png' };
      } catch (error) {
        lastError = error;
        // Solo merece otro intento un corte de tiempo o de red; un 4xx o un archivo demasiado grande se repetirían igual.
        const transient = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError' || /fetch failed|terminated|ECONNRESET|socket hang up/i.test(error.message));
        if (!transient) break;
      }
    }
    throw lastError;
  }
}

function normalizeAspectRatio(value: string): string {
  return value === 'auto' || /^\d+:\d+$/.test(value) ? value : '1:1';
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
