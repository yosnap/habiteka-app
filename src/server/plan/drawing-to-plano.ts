import { detectWallsFromImage } from './detect-walls-raster';
import { buildPlanImport } from './build-plan-import';
import type { SketchPlanResult } from '@/lib/contracts';
import type { RawSketch } from '@/server/ai/sketch/sketch-types';

/** El dibujo del usuario no necesita IA para inventariar sus muros. */
export async function drawingToPlanImport(image: Buffer) {
  const detected = await detectWallsFromImage(image);
  if (detected.walls.length < 2) {
    throw new Error(
      'Dibuja al menos dos muros rectos reconocibles. Para formas libres usa el editor.',
    );
  }
  const raw: RawSketch = {
    muros: detected.walls,
    aberturas: [],
    habitaciones: [],
    escalaFiable: false,
  };
  const result = buildPlanImport(raw, {
    includeFurniture: false,
    normalize: { wallsOverride: detected.walls, imageHeightOverWidth: detected.heightOverWidth },
  });
  return { raw, detected, result };
}

/** Compatibilidad con los consumidores que solo necesitan la geometría. */
export async function drawingToPlano(image: Buffer): Promise<SketchPlanResult> {
  const { result } = await drawingToPlanImport(image);
  return { plano: result.plano, escalaEstimada: result.escalaEstimada };
}
