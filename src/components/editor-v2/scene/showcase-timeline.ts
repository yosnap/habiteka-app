import type { EditorDocument } from '@/lib/editor-document/schema';
import { SHOWCASE_INTRO_MS } from '@/lib/editor-document/native-video';
import { videoBuildingBounds } from './video-building-bounds';
import type { ZoneMaskRegions } from '@/lib/editor-document/render-view';
import { constructionTiming, type ConstructionTimingOptions } from '@/lib/editor-document/construction-timing';

/** Terreno vacío antes de que aparezca ningún elemento del inmueble. */
export const EMPTY_TERRAIN_MS = constructionTiming().starts[0]!;
/** Fin de cada etapa de construcción (suelos, estructura, huecos y techo, mobiliario); después, el vuelo exterior. */
export const STAGE_END_MS = constructionTiming().ends;
export const BUILD_DURATION_MS = STAGE_END_MS[3];
export const REVEAL_DURATION_MS = SHOWCASE_INTRO_MS - BUILD_DURATION_MS;
export { SHOWCASE_INTRO_MS };

/** Etapa visible en un instante: -1 es el terreno vacío y 3 el inmueble terminado. */
export function showcaseStage(elapsedMs: number, options: ConstructionTimingOptions = {}): number {
  const timing = constructionTiming(options);
  if (elapsedMs < timing.starts[0]!) return -1;
  const index = timing.ends.findIndex((end) => elapsedMs < end);
  return index === -1 ? 3 : index;
}

export function stageProgress(elapsedMs: number, stage: number, starts: readonly number[], ends: readonly number[]): number {
  if (stage < 0) return 1;
  return Math.max(0, Math.min(1, (elapsedMs - starts[stage]!) / (ends[stage]! - starts[stage]!)));
}

/** Cámara del vuelo compartida; la promoción conserva su trayectoria independiente. */
export function buildingFlyFrame(doc: EditorDocument, flightProgress: number, regions: ZoneMaskRegions = []) {
  const { minX, maxX, minZ, maxZ, heightM } = videoBuildingBounds(doc, regions);
  const centerX = (minX + maxX) / 2, centerZ = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, maxZ - minZ, heightM * 1.6, 4);
  const progress = Math.max(0, Math.min(1, flightProgress));
  const angle = Math.PI * (-.25 + progress * 1.6);
  // El vuelo se acerca a la casa terminada: parte alto y lejano, y baja como un dron.
  const radius = span * (1.6 - .45 * progress);
  const height = Math.max(4, heightM / 2 + span * (.95 - .3 * progress));
  return {
    position: [centerX + Math.cos(angle) * radius, height, centerZ + Math.sin(angle) * radius] as [number, number, number],
    focus: [centerX, heightM / 2, centerZ] as [number, number, number],
    fov: 45,
  };
}

/** Cámara fija mientras se construye; el paseo usa después WalkthroughPath. */
export function showcaseFrame(doc: EditorDocument, elapsedMs: number, regions: ZoneMaskRegions = [], options: ConstructionTimingOptions = {}) {
  const timing = constructionTiming(options), end = timing.ends[3]!;
  const shot = buildingFlyFrame(doc, (elapsedMs - end) / (timing.durationMs - end), regions);
  const stage = showcaseStage(elapsedMs, options);
  return { ...shot, stage, stageProgress: stageProgress(elapsedMs, stage, timing.starts, timing.ends) };
}
