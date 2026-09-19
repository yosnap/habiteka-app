/**
 * Tabla única de atajos del editor. La leen el manejador de teclado del shell y los tooltips de las barras,
 * así ninguna tecla queda documentada en un sitio y cableada en otro.
 */
export type EditorShortcutId = 'select' | 'construct' | 'furnish' | 'measure' | 'snap' | 'pan' | 'fit' | 'zoomIn' | 'zoomOut'
  | 'wall' | 'rectangle' | 'door' | 'window' | 'passage' | 'undo' | 'redo' | 'copy' | 'paste' | 'selectAll' | 'delete';

export interface EditorShortcut { keys: string[]; label: string }

export const EDITOR_SHORTCUTS: Record<EditorShortcutId, EditorShortcut> = {
  select: { keys: ['s'], label: 'S' },
  construct: { keys: ['c'], label: 'C' },
  furnish: { keys: ['f'], label: 'F' },
  measure: { keys: ['m'], label: 'M' },
  snap: { keys: ['a'], label: 'A' },
  pan: { keys: [' '], label: 'Espacio' },
  fit: { keys: ['0'], label: '0' },
  zoomIn: { keys: ['+', '='], label: '+' },
  zoomOut: { keys: ['-', '_'], label: '−' },
  wall: { keys: ['b'], label: 'B' },
  rectangle: { keys: ['r'], label: 'R' },
  door: { keys: ['d'], label: 'D' },
  window: { keys: ['v'], label: 'V' },
  passage: { keys: ['h'], label: 'H' },
  undo: { keys: ['z'], label: '⌘Z' },
  redo: { keys: ['z'], label: '⇧⌘Z' },
  copy: { keys: ['c'], label: '⌘C' },
  paste: { keys: ['v'], label: '⌘V' },
  selectAll: { keys: ['a'], label: '⌘A' },
  delete: { keys: ['Delete', 'Backspace'], label: 'Supr' },
};

/** Texto del tooltip: «Acción · Tecla». */
export const shortcutHint = (label: string, id: EditorShortcutId) => `${label} · ${EDITOR_SHORTCUTS[id].label}`;

/** Atajo sin modificador que coincide con la tecla pulsada (las de ⌘/Ctrl se resuelven aparte). */
export function plainShortcutFor(key: string): EditorShortcutId | undefined {
  const lower = key.length === 1 ? key.toLowerCase() : key;
  return (Object.keys(EDITOR_SHORTCUTS) as EditorShortcutId[])
    .filter((id) => !['undo', 'redo', 'copy', 'paste', 'selectAll'].includes(id))
    .find((id) => EDITOR_SHORTCUTS[id].keys.includes(lower));
}
