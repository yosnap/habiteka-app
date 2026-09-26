export type NativeVideoMode = 'walkthrough' | 'showcase';
export const SHOWCASE_INTRO_MS = 8000;
export const MAX_NATIVE_VIDEO_DURATION_MS = 110_000;

export function nativeVideoDurationMs(routeDurationMs: number, mode: NativeVideoMode): number {
  return routeDurationMs + (mode === 'showcase' ? SHOWCASE_INTRO_MS : 0);
}

export function nativeVideoDurationIssue(routeDurationMs: number, mode: NativeVideoMode): string | null {
  if (!Number.isFinite(routeDurationMs) || routeDurationMs < 100) return 'El recorrido debe durar al menos 0,1 segundos.';
  const durationMs = nativeVideoDurationMs(routeDurationMs, mode);
  if (durationMs > MAX_NATIVE_VIDEO_DURATION_MS) {
    return `El vídeo duraría ${Math.ceil(durationMs / 1000)} s y el máximo es ${MAX_NATIVE_VIDEO_DURATION_MS / 1000} s. Ajusta la velocidad o los puntos del recorrido.`;
  }
  return null;
}
