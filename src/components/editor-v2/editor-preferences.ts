import type { EditorVisibility } from './visibility-menu';

/** Preferencias de vista del editor que sobreviven a recargas: se guardan por usuario en el navegador. */
export interface EditorPreferences {
  visibility: EditorVisibility;
  shortcutsEnabled: boolean;
  /** El boceto original bajo el plano 2D: oculto, sigue oculto al recargar hasta que se vuelva a mostrar. */
  originalVisible: boolean;
  originalOpacity: number;
}

const STORAGE_KEY = 'habiteka:editor:preferences:v1';
export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = { visibility: { dimensions: 'all', furniture: true, walls: true, lighting: true }, shortcutsEnabled: true,
  originalVisible: true, originalOpacity: .75 };

export function loadEditorPreferences(): EditorPreferences {
  if (typeof window === 'undefined') return DEFAULT_EDITOR_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_EDITOR_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<EditorPreferences>;
    const visibility = { ...DEFAULT_EDITOR_PREFERENCES.visibility, ...(parsed.visibility ?? {}) };
    if (!['all', 'external', 'none'].includes(visibility.dimensions)) visibility.dimensions = 'all';
    const opacity = typeof parsed.originalOpacity === 'number' && parsed.originalOpacity >= .2 && parsed.originalOpacity <= 1 ? parsed.originalOpacity : DEFAULT_EDITOR_PREFERENCES.originalOpacity;
    return { visibility, shortcutsEnabled: parsed.shortcutsEnabled ?? true, originalVisible: parsed.originalVisible ?? true, originalOpacity: opacity };
  } catch { return DEFAULT_EDITOR_PREFERENCES; }
}

export function saveEditorPreferences(preferences: EditorPreferences): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch { /* almacenamiento no disponible: la sesión sigue funcionando */ }
}
