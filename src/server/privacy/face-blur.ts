/**
 * Difuminado de caras en una imagen (minimización RGPD, art. 5: no enviar a la IA
 * caras de terceros sin necesidad).
 *
 * La DETECCIÓN se inyecta (`FaceDetector`): así la lógica de blur con `sharp` es
 * testeable sin cargar un stack de visión pesado, y el detector real
 * (`@vladmandic/human` + tfjs) se acopla solo en el entorno que lo soporta, sin
 * forzarlo en el lockfile ni en CI. Si no hay detector disponible, el llamador
 * decide la política (ver `pii-scrub`).
 */
import sharp from 'sharp';

/** Caja de una cara en píxeles absolutos: [x, y, ancho, alto]. */
export type FaceBox = [number, number, number, number];

/** Detector de caras: recibe los bytes de una imagen y devuelve sus cajas. */
export interface FaceDetector {
  detect(image: Buffer): Promise<FaceBox[]>;
}

/** Recorta una caja a los límites de la imagen (evita extract fuera de rango). */
function clampBox(box: FaceBox, imgWidth: number, imgHeight: number): FaceBox | null {
  const left = Math.max(0, Math.floor(box[0]));
  const top = Math.max(0, Math.floor(box[1]));
  const width = Math.min(imgWidth - left, Math.ceil(box[2]));
  const height = Math.min(imgHeight - top, Math.ceil(box[3]));
  if (width <= 0 || height <= 0) return null;
  return [left, top, width, height];
}

/**
 * Difumina las regiones indicadas sobre la imagen. Cada región se extrae, se
 * difumina y se recompone encima del original. Devuelve el buffer resultante
 * (PNG). Sin cajas válidas, re-codifica a PNG (normaliza, sin tocar contenido).
 */
export async function blurRegions(image: Buffer, boxes: FaceBox[]): Promise<Buffer> {
  const base = sharp(image);
  const meta = await base.metadata();
  if (!meta.width || !meta.height) {
    throw new Error('No se pudieron leer las dimensiones de la imagen para el blur');
  }

  const regions = boxes
    .map((b) => clampBox(b, meta.width!, meta.height!))
    .filter((r): r is FaceBox => r !== null);

  if (regions.length === 0) {
    return base.png().toBuffer();
  }

  const overlays = await Promise.all(
    regions.map(async ([left, top, width, height]) => ({
      input: await sharp(image).extract({ left, top, width, height }).blur(20).toBuffer(),
      left,
      top,
    })),
  );

  return sharp(image).composite(overlays).png().toBuffer();
}

/**
 * Difumina todas las caras detectadas. Si el detector no encuentra caras, la
 * imagen se devuelve re-codificada a PNG sin más.
 */
export async function blurFaces(detector: FaceDetector, image: Buffer): Promise<Buffer> {
  const boxes = await detector.detect(image);
  return blurRegions(image, boxes);
}
