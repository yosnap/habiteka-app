export type ConstructionDurationSeconds = 8 | 12;
export interface ConstructionTimingOptions { constructionDurationSeconds?: ConstructionDurationSeconds }
export const DEFAULT_CONSTRUCTION_SECONDS: ConstructionDurationSeconds = 8;

/** Imagen, sonido, guion y guardado comparten estos tiempos; los muros ocupan siempre tres segundos. */
export function constructionTiming(options: ConstructionTimingOptions = {}) {
  const seconds = options.constructionDurationSeconds ?? DEFAULT_CONSTRUCTION_SECONDS;
  const starts: readonly [number, number, number, number] = seconds === 12 ? [500, 1500, 4500, 5500] : [500, 1300, 4300, 5100];
  const ends: readonly [number, number, number, number] = seconds === 12 ? [1500, 4500, 5500, 9000] : [1300, 4300, 5100, 6000];
  return { durationMs: seconds * 1000, starts, ends };
}
