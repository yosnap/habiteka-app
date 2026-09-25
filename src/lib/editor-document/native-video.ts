export type NativeVideoMode = 'walkthrough' | 'showcase';
export const SHOWCASE_INTRO_MS = 8000;

export function nativeVideoDurationMs(routeDurationMs: number, mode: NativeVideoMode): number {
  return routeDurationMs + (mode === 'showcase' ? SHOWCASE_INTRO_MS : 0);
}
