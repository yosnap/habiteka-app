import { canvasToBoundedImage } from '@/components/chat/prepare-upload';
import type { UploadedImage } from '@/components/chat/image-upload';

/**
 * Rasteriza la primera página de un PDF EN EL NAVEGADOR con pdf.js y devuelve
 * una imagen en base64 (PNG, o JPEG si no cabe en el presupuesto de la Server
 * Action) lista para el mismo flujo que una imagen subida. El PDF no
 * viaja nunca al servidor (cero parseo de PDF en backend: superficie de ataque
 * y dependencias nativas fuera). pdf.js se carga bajo demanda.
 */

// Lado mayor del raster: suficiente para la detección de muros (se normaliza a 2048 en servidor).
const MAX_SIDE = 2400;

export interface RasterizedPdf extends UploadedImage {
  width: number;
  height: number;
}

export async function pdfFirstPageToPng(file: File): Promise<RasterizedPdf> {
  const pdfjs = await import('pdfjs-dist');
  // Next empaqueta el worker como asset.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  return rasterizePdfFirstPage(file, pdfjs.getDocument);
}

/** Núcleo compartido con la prueba Node, que usa el build legacy de pdf.js. */
export async function rasterizePdfFirstPage(
  file: File,
  getDocument: typeof import('pdfjs-dist').getDocument,
): Promise<RasterizedPdf> {
  const data = new Uint8Array(await file.arrayBuffer());
  const task = getDocument({ data });
  const pdf = await task.promise;
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = MAX_SIDE / Math.max(base.width, base.height);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar el lienzo para el PDF.');
    // Fondo blanco: un PDF con transparencia se leería como muros negros.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return { ...canvasToBoundedImage(canvas), width: canvas.width, height: canvas.height };
  } finally {
    await task.destroy();
  }
}
