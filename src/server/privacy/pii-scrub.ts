/**
 * Minimización de PII en imágenes antes de enviarlas a la IA (RGPD art. 5).
 *
 * Dos capas:
 *  1. Blur de caras de terceros (detector inyectado; ver `face-blur`). Opcional:
 *     si no hay detector disponible se aplica la política `onNoDetector`.
 *  2. Strip de EXIF/geolocalización + re-codificación, que ya realiza el
 *     `sanitizeImageBuffer` de F3 (no se duplica: se reutiliza).
 *
 * El orden importa: primero se difuminan las caras sobre el buffer original y
 * luego el sanitizer re-codifica y elimina metadatos. Así la salida no lleva ni
 * caras reconocibles ni EXIF/geo.
 */
import { blurFaces, type FaceDetector } from './face-blur';
import { sanitizeImageBuffer, type SanitizedImage } from '@/server/ai/image/input-sanitizer';

export interface PiiScrubOptions {
  detector?: FaceDetector;
  /**
   * Qué hacer si no hay detector de caras configurado:
   *  - 'continue' (por defecto): sigue con strip de EXIF; el blur queda como
   *    mejora pendiente (documentado como riesgo conocido en la política).
   *  - 'reject': lanza, para entornos que exijan blur obligatorio.
   */
  onNoDetector?: 'continue' | 'reject';
}

export class FaceBlurUnavailableError extends Error {
  constructor() {
    super('Blur de caras no disponible y la política exige difuminado');
    this.name = 'FaceBlurUnavailableError';
  }
}

/**
 * Aplica minimización completa y devuelve la imagen saneada lista para la IA
 * (PNG sin EXIF, con caras difuminadas si había detector).
 */
export async function scrubImageForAi(
  image: Buffer,
  options: PiiScrubOptions = {},
): Promise<SanitizedImage> {
  const onNoDetector = options.onNoDetector ?? 'continue';

  let working = image;
  if (options.detector) {
    working = await blurFaces(options.detector, image);
  } else if (onNoDetector === 'reject') {
    throw new FaceBlurUnavailableError();
  }

  // El sanitizer de F3 valida bytes/dimensiones, elimina EXIF y re-codifica.
  return sanitizeImageBuffer(working);
}
