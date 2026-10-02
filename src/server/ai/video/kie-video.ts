import 'server-only';
import { DESIGN_VIDEO_MODEL, type DesignVideoSettings } from '@/lib/editor-document/design-video';
import { constructionTiming } from '@/lib/editor-document/construction-timing';
import type { SanitizedImage } from '../image/input-sanitizer';
import { assertSafeImportUrl } from '@/server/admin/media/url-safety';

export class KieSubmissionUnknownError extends Error {}
export class KieSubmissionRejectedError extends Error {}
const API = 'https://api.kie.ai/api/v1/jobs';

/** Creación separada de consulta: consultar o descargar nunca vuelve a generar ni cobrar. */
export class KieVideoProvider {
  constructor(private readonly key: string) {}

  async uploadReference(image: SanitizedImage) {
    const response = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
      method: 'POST', headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data: `data:${image.mimeType};base64,${image.base64}`,
        uploadPath: 'images/habiteka-video', fileName: `${crypto.randomUUID()}.png` }), signal: AbortSignal.timeout(30000),
    });
    const body = await response.json() as { success?: boolean; data?: { downloadUrl?: string; fileUrl?: string } };
    const url = body.data?.downloadUrl ?? body.data?.fileUrl;
    if (!response.ok || body.success === false || !url?.startsWith('https://')) throw new Error('KIE no pudo preparar una referencia. No se ha iniciado la generación.');
    return url;
  }

  async create(prompt: string, settings: DesignVideoSettings, references: string[]) {
    if (!references.length || references.length > 9 || prompt.length > 7000) throw new KieSubmissionRejectedError('Referencias o guion fuera del límite de H3.');
    let response: Response;
    try {
      response = await fetch(`${API}/createTask`, { method: 'POST', headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: DESIGN_VIDEO_MODEL, input: { prompt, reference_image_urls: references,
          duration: constructionTiming(settings.presentation).durationMs / 1000, aspect_ratio: '16:9', resolution: settings.resolution } }),
        signal: AbortSignal.timeout(30000) });
    } catch { throw new KieSubmissionUnknownError('No se pudo confirmar si KIE recibió la tarea. No se relanzará ni se cobrará una segunda generación automáticamente.'); }
    let body: { code?: number; data?: { taskId?: string } };
    try { body = await response.json(); }
    catch { throw new KieSubmissionUnknownError('KIE devolvió una respuesta ilegible; comprueba la tarea en el proveedor antes de volver a generar.'); }
    if (body.data?.taskId && body.code === 200) return body.data.taskId;
    if (body.code && body.code !== 200 && response.status < 500) throw new KieSubmissionRejectedError('KIE rechazó la solicitud. Revisa saldo y configuración del proveedor.');
    throw new KieSubmissionUnknownError('KIE no devolvió un identificador fiable. No se relanzará la generación.');
  }

  async status(taskId: string): Promise<{ state: 'pending' | 'failed' | 'success'; resultUrl?: string }> {
    const response = await fetch(`${API}/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${this.key}` }, signal: AbortSignal.timeout(30000), cache: 'no-store',
    });
    const body = await response.json() as { code?: number; data?: { taskId?: string; state?: string; resultJson?: string } };
    if (!response.ok || body.code !== 200 || body.data?.taskId !== taskId) throw new Error('No se pudo consultar la tarea guardada de KIE. Puedes volver a consultar sin generar otro vídeo.');
    if (body.data.state === 'fail') return { state: 'failed' };
    if (body.data.state !== 'success') return { state: 'pending' };
    const result = JSON.parse(body.data.resultJson ?? '{}') as { resultUrls?: string[] };
    const url = result.resultUrls?.[0];
    if (!url) throw new Error('La tarea terminó, pero KIE no devolvió el MP4. Vuelve a consultar sin regenerar.');
    return { state: 'success', resultUrl: assertSafeImportUrl(url).toString() };
  }

  async download(url: string) {
    const response = await fetch(assertSafeImportUrl(url), { redirect: 'error', signal: AbortSignal.timeout(120000) });
    if (!response.ok || !response.body) throw new Error('No se pudo recuperar el MP4 ya generado. Vuelve a consultar; no se generará de nuevo.');
    const reader = response.body.getReader(), chunks: Buffer[] = []; let size = 0;
    try {
      for (;;) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength;
        if (size > 100 * 1024 * 1024) { await reader.cancel(); throw new Error('El MP4 supera los 100 MB.'); }
        chunks.push(Buffer.from(part.value));
      }
    } finally { reader.releaseLock(); }
    const bytes = Buffer.concat(chunks, size);
    if (bytes.subarray(4, 8).toString() !== 'ftyp') throw new Error('El resultado no es un MP4 válido.');
    return bytes;
  }
}
