import type { EditorDocument } from '@/lib/editor-document/schema';
import { SHOWCASE_INTRO_MS } from '@/lib/editor-document/native-video';

/** Terreno vacío antes de que aparezca ningún elemento del inmueble. */
export const EMPTY_TERRAIN_MS = 2000;
/** Fin de cada etapa de construcción (suelos, estructura, huecos y techo, mobiliario); después, el vuelo exterior. */
export const STAGE_END_MS = [4500, 7500, 9500, 11000] as const;
export const BUILD_DURATION_MS = STAGE_END_MS[3];
export const REVEAL_DURATION_MS = SHOWCASE_INTRO_MS - BUILD_DURATION_MS;
export { SHOWCASE_INTRO_MS };

/** Etapa visible en un instante: -1 es el terreno vacío y 3 el inmueble terminado. */
export function showcaseStage(elapsedMs: number): number {
  if (elapsedMs < EMPTY_TERRAIN_MS) return -1;
  const index = STAGE_END_MS.findIndex((end) => elapsedMs < end);
  return index === -1 ? 3 : index;
}

/** Guion determinista de la introducción; el paseo usa después WalkthroughPath. */
export function showcaseFrame(doc: EditorDocument, elapsedMs: number) {
  const xs = doc.vertices.map((vertex) => vertex.x / 1000);
  const zs = doc.vertices.map((vertex) => vertex.y / 1000);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const centerX = (minX + maxX) / 2, centerZ = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, maxZ - minZ, 4);
  const progress = Math.max(0, Math.min(1, elapsedMs / SHOWCASE_INTRO_MS));
  const angle = Math.PI * (-.25 + progress * 1.6);
  // El vuelo se acerca a la casa terminada: parte alto y lejano, y baja como un dron.
  const radius = span * (1.6 - .45 * progress);
  const height = Math.max(4, span * (.95 - .3 * progress));
  return {
    stage: showcaseStage(elapsedMs),
    position: [centerX + Math.cos(angle) * radius, height, centerZ + Math.sin(angle) * radius] as [number, number, number],
    focus: [centerX, 1, centerZ] as [number, number, number],
    fov: 45,
  };
}
