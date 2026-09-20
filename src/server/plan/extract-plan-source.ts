/**
 * Extracción CRUDA de un plano: el modelo de visión (semántica: estancias,
 * huecos, cotas, mobiliario) y la detección de píxeles (muros con posición
 * exacta) corren en paralelo. Devuelve ambas fuentes sin normalizar para que
 * cada consumidor (boceto → `SketchPlanResult`, plano dibujado →
 * `PlanImportResult`) las combine a su manera.
 */
import type { ChatVisionAdapter, MessagePart } from '@/lib/contracts';
import {
  extractSketchGeometry,
  type SketchSource,
} from '@/server/ai/sketch/extract-sketch-geometry';
import type { RawSketch } from '@/server/ai/sketch/sketch-types';
import { detectWallsFromImage, type DetectedWalls } from './detect-walls-raster';

export interface ExtractedPlanSource {
  raw: RawSketch;
  detected: DetectedWalls | null;
}

// Menos muros medidos que esto = la imagen no era un plano nítido.
const MIN_DETECTED_WALLS = 4;

export async function extractPlanSource(
  chat: ChatVisionAdapter,
  imageParts: MessagePart[],
  source: SketchSource,
): Promise<ExtractedPlanSource> {
  const firstBase64 = imageParts.find(
    (p): p is Extract<MessagePart, { type: 'image_url' }> => p.type === 'image_url',
  )?.base64;
  const [raw, detected] = await Promise.all([
    extractSketchGeometry(chat, imageParts, source),
    firstBase64
      ? detectWallsFromImage(Buffer.from(firstBase64, 'base64')).catch(() => null)
      : Promise.resolve(null),
  ]);
  if (raw.muros.length === 0 && (detected?.walls.length ?? 0) < MIN_DETECTED_WALLS) {
    throw new Error('No se reconocieron muros en la imagen: prueba con un plano más nítido en planta.');
  }
  return { raw, detected };
}
