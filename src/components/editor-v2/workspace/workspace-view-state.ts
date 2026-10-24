import type { EditorViewMode } from '@/canvas/editor-v2/view-mode';

/** Solo preferencias de navegación; nunca contiene documentos ni borradores. */
export function workspaceViewKey(
  owner: string | undefined,
  projectId: string | undefined,
  zoneId: string | null | undefined,
) {
  return owner && projectId
    ? `habiteka:workspace-view:v1:${JSON.stringify([owner, projectId, zoneId ?? null])}`
    : null;
}

export function parseWorkspaceView(value: string | null): EditorViewMode {
  return value === 'visual' || value === '3d' ? value : '2d';
}

export function readWorkspaceView(key: string | null): EditorViewMode {
  if (!key || typeof window === 'undefined') return '2d';
  const fallback = memoryViews.get(key);
  if (fallback) return fallback;
  try {
    const stored = window.sessionStorage.getItem(key);
    return stored === null ? (memoryViews.get(key) ?? '2d') : parseWorkspaceView(stored);
  } catch {
    return memoryViews.get(key) ?? '2d';
  }
}

const memoryViews = new Map<string, EditorViewMode>();

export function writeWorkspaceView(key: string | null, value: EditorViewMode) {
  if (!key || typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, value);
    memoryViews.delete(key);
  } catch {
    memoryViews.set(key, value);
    /* La navegación sigue disponible sin almacenamiento. */
  }
}
