import { detectWallsFromImage } from './detect-walls-raster';
import { normalizeSketch } from '@/server/ai/sketch/normalize-geometry';
import type { SketchPlanResult } from '@/lib/contracts';

/** El dibujo del usuario no necesita IA para inventariar sus muros. */
export async function drawingToPlano(image: Buffer): Promise<SketchPlanResult> {
  const detected = await detectWallsFromImage(image);
  if (detected.walls.length < 2) {
    throw new Error(
      'Dibuja al menos dos muros rectos reconocibles. Para formas libres usa el editor.',
    );
  }
  const plano = normalizeSketch(
    {
      muros: detected.walls,
      aberturas: [],
      habitaciones: [],
      escalaFiable: false,
    },
    { wallsOverride: detected.walls, imageHeightOverWidth: detected.heightOverWidth },
  );
  return { plano, escalaEstimada: true };
}
