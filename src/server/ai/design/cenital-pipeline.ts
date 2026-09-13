/**
 * Pipeline del render cenital (F3): plano métrico → raster de referencia →
 * generación image-to-image. El modelo de imagen recibe el plano COMO IMAGEN
 * (la autoridad sobre la disposición) y el prompt solo aporta usos y estilo —
 * el arreglo estructural al pipeline anterior, que describía el plano en texto
 * y el modelo inventaba la disposición.
 *
 * El payload llega del cliente: `assertPlanoRasterizable` acota tamaño y
 * coordenadas antes de rasterizar (un SVG desmesurado tumbaría sharp).
 */
import type { Estilo, ImageAdapter, ImageResult, Plano2dPayload } from '@/lib/contracts';
import { rasterizePlano, type PlanRasterResult } from '@/server/plan/rasterize-plan-svg';
import { buildCenitalImagePrompt, buildCenitalPrompt } from './room-prompt-builder';

// Cotas de cordura del payload (un plano real está muy por debajo).
const MAX_ZONES = 50;
const MAX_WALLS = 600;
const MAX_COORD_MM = 200_000; // 200 m

export interface CenitalDeps {
  image: ImageAdapter;
  /** Rasterizador inyectable para tests (por defecto, el real con sharp). */
  rasterize?: (plano: Plano2dPayload) => Promise<PlanRasterResult>;
}

/** Valida que el plano es razonable antes de rasterizarlo. Lanza si no. */
export function assertPlanoRasterizable(plano: Plano2dPayload): void {
  if (!Array.isArray(plano.zones) || plano.zones.length === 0) {
    throw new Error('El plano está vacío.');
  }
  if (plano.zones.length > MAX_ZONES) throw new Error('El plano tiene demasiadas zonas.');
  const walls = plano.zones.flatMap((z) => z.walls);
  if (walls.length === 0) throw new Error('El plano no tiene muros.');
  if (walls.length > MAX_WALLS) throw new Error('El plano tiene demasiados muros.');
  const points = plano.zones.flatMap((z) => [
    ...z.walls.flatMap((w) => [w.from, w.to]),
    ...z.outline,
  ]);
  for (const p of points) {
    if (
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y) ||
      Math.abs(p.x) > MAX_COORD_MM ||
      Math.abs(p.y) > MAX_COORD_MM
    ) {
      throw new Error('El plano contiene coordenadas fuera de rango.');
    }
  }
}

/** Genera el render cenital fotorrealista condicionado al raster del plano. */
export async function generateCenital(
  deps: CenitalDeps,
  plano: Plano2dPayload,
  estilo: Estilo,
): Promise<ImageResult> {
  assertPlanoRasterizable(plano);
  const raster = await (deps.rasterize ?? rasterizePlano)(plano);
  return deps.image.generate({
    prompt: buildCenitalPrompt(plano, estilo),
    referenceImage: { base64: raster.base64, mimeType: 'image/png' },
    aspectRatio: raster.aspectRatio,
  });
}

/**
 * Cenital directamente desde la IMAGEN del plano (el redibujado): sin pasar
 * por la geometría vectorial. Los nombres de las estancias están rotulados en
 * la propia imagen y el modelo los lee — misma vía imagen→imagen que hizo
 * fiel el redibujado.
 */
export async function generateCenitalFromImage(
  deps: { image: CenitalDeps['image'] },
  source: { base64: string; mimeType?: string; aspectRatio?: string },
  estilo: Estilo,
  /** Detalles del propietario (mobiliario real, singularidades por estancia). */
  ownerNotes = '',
  canvasDescription?: string,
): Promise<ImageResult> {
  return deps.image.generate({
    prompt: canvasDescription
      ? [
          'Convierte esta planta AMUEBLADA en una fotografía cenital estricta, ortográfica, sin techo.',
          'Mantén todos los objetos exactamente donde están, con la misma orientación y tamaño.',
          'Solo las franjas oscuras perimetrales son muros. Los rectángulos beige son MUEBLES, nunca tabiques.',
          'No añadas muros, habitaciones, puertas, ventanas ni muebles no dibujados. No copies líneas de dibujo ni textos.',
          `Materiales e interiorismo de estilo ${estilo}.`,
          canvasDescription,
          ownerNotes.slice(0, 800),
        ].join('\n')
      : buildCenitalImagePrompt(estilo, ownerNotes),
    referenceImage: { base64: source.base64, mimeType: source.mimeType ?? 'image/png' },
    ...(source.aspectRatio ? { aspectRatio: source.aspectRatio } : {}),
  });
}
