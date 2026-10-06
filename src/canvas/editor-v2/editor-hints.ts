import type { EditorDocument } from '@/lib/editor-document/schema';
import { planObjects } from '@/lib/editor-document/boundary-types';
import type { EditorTool } from './store';

/**
 * Pista de teclas para lo que se está haciendo, visible junto al lienzo: así nadie tiene que memorizar los
 * modificadores. Devuelve null cuando no hay nada útil que decir.
 */
export function editorHint(tool: EditorTool, selection: readonly string[], doc: EditorDocument, drawing: boolean, mod = modifierKey()): string | null {
  if (tool === 'wall' || tool === 'guard-wall') return drawing
    ? `Clic: siguiente esquina · teclea una medida (p. ej. 3,25) y pulsa Enter · mantén ${mod} para no pegarte a esquinas ni paredes · Esc: terminar`
    : `Clic: empezar la pared · mantén ${mod} para no pegarte a esquinas ni paredes · Esc: salir`;
  if (tool === 'rectangle') return 'Arrastra para dibujar una habitación · Esc: cancelar';
  if (tool === 'door' || tool === 'window' || tool === 'passage') return 'Clic sobre una pared para colocarla · Esc: cancelar';
  if (tool === 'measure') return 'Arrastra para medir · Esc: cancelar';
  if (tool === 'split-wall') return 'Clic sobre la pared para añadir la esquina · Esc: cancelar';
  if (tool !== 'select') return null;
  if (!selection.length) return `Clic: seleccionar · ${mod}/Mayús: añadir a la selección · doble clic: propiedades · Alt + doble clic en una pared: añadir esquina · A: imanes · Espacio: mover la vista`;
  const ids = new Set(selection);
  if (doc.walls.some((wall) => ids.has(wall.id)))
    return `Arrastra un extremo para mover la esquina (mantén ${mod} para alargar solo esta pared sin pegarte a esquinas; teclea una medida y pulsa Enter) · doble clic: propiedades · Alt + doble clic: añadir esquina · Alt+arrastrar: duplicar`;
  if (doc.openings.some((opening) => ids.has(opening.id)))
    return 'Bordes: cambiar el ancho (Alt: desde el centro) · Alt+arrastrar: copiar a otra pared · Supr: borrar';
  const objects = [...planObjects(doc), ...(doc.stairs ?? []), ...(doc.ramps ?? []), ...(doc.columns ?? [])];
  if (objects.some((item) => ids.has(item.id)))
    return 'Esquinas: redimensionar (Alt: desde el centro) · fuera de una esquina: girar (Mayús: 15°) · Alt+arrastrar: duplicar · flechas: mover (Mayús: 10 cm)';
  return null;
}

/** ⌘ en Mac y Ctrl en el resto: la tecla que el usuario tiene que buscar en su teclado. */
export function modifierKey(): string {
  if (typeof navigator === 'undefined') return '⌘/Ctrl';
  return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';
}
