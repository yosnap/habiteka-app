export interface WorkspaceCameraState {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

/** Preferencia local validada, separada de las cámaras de renders y recorridos. */
export function parseWorkspaceCamera(value: string | null): WorkspaceCameraState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as WorkspaceCameraState;
    const tuple = (v: unknown): v is [number, number, number] =>
      Array.isArray(v) &&
      v.length === 3 &&
      v.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1_000_000);
    if (
      !parsed ||
      !tuple(parsed.position) ||
      !tuple(parsed.target) ||
      !Number.isFinite(parsed.fov) ||
      parsed.fov < 1 ||
      parsed.fov > 120
    )
      return null;
    if (
      Math.hypot(
        parsed.position[0] - parsed.target[0],
        parsed.position[1] - parsed.target[1],
        parsed.position[2] - parsed.target[2],
      ) < 0.01
    )
      return null;
    return { position: parsed.position, target: parsed.target, fov: parsed.fov };
  } catch {
    return null;
  }
}

export function readWorkspaceCamera(key?: string): WorkspaceCameraState | null {
  if (!key || typeof window === 'undefined') return null;
  try {
    return parseWorkspaceCamera(window.sessionStorage.getItem(key));
  } catch {
    return null;
  }
}

export function saveWorkspaceCamera(key: string | undefined, state: WorkspaceCameraState) {
  if (!key || typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* No impide mover la cámara. */
  }
}
