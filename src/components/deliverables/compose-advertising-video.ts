import { videoFormatSize } from '@/lib/editor-document/video-format';
import type { AdvertisingVideoOptions } from '@/lib/editor-document/advertising-video';
import type { VideoMeasurements } from '@/lib/editor-document/video-measurements';
import { advertisingFrame } from './advertising-frame';

/** Compone un archivo existente; conserva su audio y no llama a ningún proveedor IA. */
export async function composeAdvertisingVideo(url: string, options: AdvertisingVideoOptions, measurements: VideoMeasurements | null,
  signal: AbortSignal, progress: (value: number) => void) {
  signal.throwIfAborted();
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('No se pudo descargar el vídeo original.');
  const limit = 100 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > limit) throw new Error('El vídeo original supera 100 MB.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No se pudo leer el vídeo original.');
  const chunks: Uint8Array<ArrayBuffer>[] = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) throw new Error('El vídeo original supera 100 MB.');
      chunks.push(new Uint8Array(value));
    }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  signal.throwIfAborted();
  const { Input, BlobSource, ALL_FORMATS, Output, BufferTarget, Mp4OutputFormat, Conversion } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(new Blob(chunks)), formats: ALL_FORMATS });
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  let conversion: import('mediabunny').Conversion | undefined;
  let firstTimestamp: number | undefined;
  const cancel = () => { void conversion?.cancel().catch(() => undefined); };
  try {
    const duration = await input.computeDuration();
    // La cola AAC de una exportación nativa puede añadir 64 ms al tiempo nominal.
    if (!Number.isFinite(duration) || duration <= 0 || duration > 110.25) throw new Error('El clip debe durar entre 0 y 110 segundos.');
    const { width, height } = videoFormatSize(options.format), canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); if (!context) throw new Error('No se pudo preparar el anuncio.');
    conversion = await Conversion.init({ input, output, tracks: 'primary', showWarnings: false,
      video: { codec: 'avc', bitrate: 8_000_000, processedWidth: width, processedHeight: height,
        process: sample => {
          signal.throwIfAborted();
          firstTimestamp ??= sample.timestamp;
          advertisingFrame(context, width, height, sample.displayWidth, sample.displayHeight, (sample.timestamp - firstTimestamp) * 1000, options, measurements,
            rect => sample.draw(context, rect.x, rect.y, rect.width, rect.height));
          return canvas;
        } }, audio: { codec: 'aac' } });
    if (!conversion.isValid || conversion.discardedTracks.length) throw new Error('Este navegador no puede conservar todas las pistas del clip. Usa uno con WebCodecs H.264/AAC.');
    signal.addEventListener('abort', cancel, { once: true }); signal.throwIfAborted();
    conversion.onProgress = value => progress(value);
    await conversion.execute(); signal.throwIfAborted();
    const blob = new Blob([output.target.buffer!], { type: 'video/mp4' });
    if (blob.size > limit) throw new Error('El anuncio supera 100 MB.');
    progress(1); return { blob, durationMs: Math.round(duration * 1000) };
  } finally {
    signal.removeEventListener('abort', cancel);
    if (conversion && conversion.state !== 'done' && conversion.state !== 'canceled') await conversion.cancel();
    if (!conversion && output.state !== 'finalized' && output.state !== 'canceled') await output.cancel();
    input.dispose();
  }
}
