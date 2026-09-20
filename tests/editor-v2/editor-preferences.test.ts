import { expect, it } from 'vitest';
import { DEFAULT_EDITOR_PREFERENCES, loadEditorPreferences, saveEditorPreferences } from '@/components/editor-v2/editor-preferences';

it('las preferencias de vista se guardan y se recuperan; los valores corruptos vuelven al valor por defecto', () => {
  const storage = new Map<string, string>();
  const fakeWindow = { localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => { storage.set(k, v); } } };
  Object.assign(globalThis, { window: fakeWindow });
  try {
    expect(loadEditorPreferences()).toEqual(DEFAULT_EDITOR_PREFERENCES);
    saveEditorPreferences({ visibility: { dimensions: 'external', furniture: false, walls: true }, shortcutsEnabled: false });
    expect(loadEditorPreferences()).toEqual({ visibility: { dimensions: 'external', furniture: false, walls: true }, shortcutsEnabled: false });
    storage.set('habiteka:editor:preferences:v1', JSON.stringify({ visibility: { dimensions: 'rara' } }));
    expect(loadEditorPreferences().visibility.dimensions).toBe('all');
    storage.set('habiteka:editor:preferences:v1', '{no es json');
    expect(loadEditorPreferences()).toEqual(DEFAULT_EDITOR_PREFERENCES);
  } finally { Reflect.deleteProperty(globalThis, 'window'); }
});
