import { tourDurationMs, tourFrameAt, type TourImage } from '@/lib/editor-document/image-tour';

const WIDTH = 1920, HEIGHT = 1080, FPS = 30, BITRATE = 6_000_000;

/** Descarga cada imagen una sola vez; una imagen que no carga anula el montaje en lugar de dejar un hueco. */
async function loadBitmaps(shots: TourImage[], signal: AbortSignal): Promise<ImageBitmap[]> {
  return Promise.all(shots.map(async (shot) => {
    const response = await fetch(shot.url, { signal });
    if (!response.ok) throw new Error(`No se pudo cargar la imagen de «${shot.ambient}».`);
    return createImageBitmap(await response.blob());
  }));
}

/** Pinta la imagen cubriendo el encuadre 16:9, con zoom y desplazamiento dentro del margen sobrante. */
function drawCover(context: CanvasRenderingContext2D, bitmap: ImageBitmap, zoom: number, panX: number, panY: number, alpha: number) {
  const scale = Math.max(WIDTH / bitmap.width, HEIGHT / bitmap.height) * zoom;
  const drawWidth = bitmap.width * scale, drawHeight = bitmap.height * scale;
  const slackX = (drawWidth - WIDTH) / 2, slackY = (drawHeight - HEIGHT) / 2;
  context.globalAlpha = alpha;
  context.drawImage(bitmap, -slackX - panX * slackX, -slackY - panY * slackY, drawWidth, drawHeight);
  context.globalAlpha = 1;
}

/** Codifica en el navegador un MP4 H.264 a 1080p con las imágenes en el orden dado; el tiempo del vídeo no depende del equipo. */
export async function recordImageTour(shots: TourImage[], signal: AbortSignal, progress: (value: number) => void): Promise<{ blob: Blob; durationMs: number }> {
  if (!shots.length) throw new Error('Elige al menos una imagen para el montaje.');
  if (typeof VideoEncoder === 'undefined') throw new Error('Este navegador no permite exportar H.264. Usa un navegador con WebCodecs.');
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, canEncodeVideo } = await import('mediabunny');
  if (!await canEncodeVideo('avc', { width: WIDTH, height: HEIGHT, bitrate: BITRATE })) throw new Error('H.264 a 1080p no está disponible en este navegador.');
  const bitmaps = await loadBitmaps(shots, signal);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH; canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo preparar el lienzo del vídeo.');
  const durationMs = tourDurationMs(shots.length), frames = Math.ceil(durationMs / 1000 * FPS);
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  try {
    const source = new CanvasSource(canvas, { codec: 'avc', bitrate: BITRATE });
    output.addVideoTrack(source, { frameRate: FPS }); await output.start();
    for (let frame = 0; frame < frames; frame++) {
      signal.throwIfAborted();
      const shot = tourFrameAt(shots.length, frame / FPS * 1000);
      context.fillStyle = '#000'; context.fillRect(0, 0, WIDTH, HEIGHT);
      for (const layer of shot.layers) {
        // La imagen que aparece lo hace con la opacidad del fundido; la que queda debajo, opaca.
        drawCover(context, bitmaps[layer.index]!, layer.zoom, layer.panX, layer.panY, layer.index === shot.index ? shot.alpha : 1);
      }
      await source.add(frame / FPS, 1 / FPS, { keyFrame: frame % (FPS * 2) === 0 });
      if (frame % 10 === 0) { progress(frame / frames); await new Promise<void>((resolve) => setTimeout(resolve, 0)); }
    }
    await output.finalize(); progress(1);
    return { blob: new Blob([output.target.buffer!], { type: 'video/mp4' }), durationMs };
  } catch (error) {
    if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel();
    throw error;
  } finally { bitmaps.forEach((bitmap) => bitmap.close()); }
}
