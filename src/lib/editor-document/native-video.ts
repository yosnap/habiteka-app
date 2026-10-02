import { PROMOTION_DURATION_MS } from './promotion-video';
import { constructionTiming, type ConstructionTimingOptions } from './construction-timing';
export type NativeVideoMode = 'walkthrough' | 'showcase' | 'promotion' | 'construction';
export const CONSTRUCTION_DURATION_MS = constructionTiming().durationMs;
export const CONSTRUCTION_ROUTE_ID = 'building-construction';
export const nativeVideoNeedsRoute = (mode: NativeVideoMode) => mode === 'walkthrough' || mode === 'showcase';
/** Terreno vacío, construcción por etapas y vuelo exterior antes del recorrido interior. */
export const SHOWCASE_INTRO_MS = CONSTRUCTION_DURATION_MS;
export const MAX_NATIVE_VIDEO_DURATION_MS = 110_000;

export function nativeVideoDurationMs(routeDurationMs: number, mode: NativeVideoMode, options: ConstructionTimingOptions = {}): number {
  return mode === 'construction' ? constructionTiming(options).durationMs : mode === 'promotion' ? PROMOTION_DURATION_MS : routeDurationMs + (mode === 'showcase' ? constructionTiming(options).durationMs : 0);
}

export function nativeVideoDurationIssue(routeDurationMs: number, mode: NativeVideoMode, options: ConstructionTimingOptions = {}): string | null {
  if (!nativeVideoNeedsRoute(mode)) return null;
  if (!Number.isFinite(routeDurationMs) || routeDurationMs < 100) return 'El recorrido debe durar al menos 0,1 segundos.';
  const durationMs = nativeVideoDurationMs(routeDurationMs, mode, options);
  if (durationMs > MAX_NATIVE_VIDEO_DURATION_MS) {
    return `El vídeo duraría ${Math.ceil(durationMs / 1000)} s y el máximo es ${MAX_NATIVE_VIDEO_DURATION_MS / 1000} s. Ajusta la velocidad o los puntos del recorrido.`;
  }
  return null;
}
