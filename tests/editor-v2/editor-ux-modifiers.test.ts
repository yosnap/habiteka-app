/**
 * Edición más amigable: prolongar una pared más allá de una esquina sin unirla (⌘/Ctrl), escribir la medida mientras se
 * dibuja o arrastra, añadir una esquina con doble clic y pistas de teclas según lo que se hace.
 */
import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { previewVertex } from '@/canvas/editor-v2/vertex-preview';
import { snapWallPoint } from '@/canvas/editor-v2/snap-candidates';
import { pointAtLength, typedLengthKey } from '@/canvas/editor-v2/typed-length';
import { editorHint } from '@/canvas/editor-v2/editor-hints';
import { createEditorStore } from '@/canvas/editor-v2/store';

// Dos paredes en L que comparten la esquina (3000, 0).
const corner = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 2000 }], false);
const at = (doc: ReturnType<typeof corner>, x: number, y: number) => doc.vertices.find((v) => Math.abs(v.x - x) < 1 && Math.abs(v.y - y) < 1)!;

describe('⌘/Ctrl: prolongar una pared más allá de la esquina sin unirla', () => {
  it('solo se mueve la pared elegida y la esquina queda unida en T sobre la pared prolongada', () => {
    const doc = corner(), shared = at(doc, 3000, 0);
    const horizontal = doc.walls.find((w) => [w.startVertexId, w.endVertexId].includes(shared.id) && doc.vertices.some((v) => v.y === 0 && v.x === 0 && [w.startVertexId, w.endVertexId].includes(v.id)))!;
    const preview = previewVertex(doc, shared.id, { x: 5000, y: 0 }, 1, true, { free: true, detachWalls: [horizontal.id] });
    expect(preview.error).toBeNull();
    const next = preview.document;
    // La vertical sigue en (3000, 0), y esa esquina une ahora tres tramos: 0→3000, 3000→5000 y la vertical.
    const kept = at(next, 3000, 0);
    expect(kept.id).toBe(shared.id);
    expect(next.walls.filter((w) => w.startVertexId === kept.id || w.endVertexId === kept.id)).toHaveLength(3);
    expect(at(next, 5000, 0)).toBeDefined();
  });

  it('sin ⌘ la esquina se mueve con las dos paredes; con ⌘ no se pega a otra esquina cercana', () => {
    const doc = addWallPath(corner(), [{ x: 6000, y: 0 }, { x: 6000, y: 2000 }], false), shared = at(doc, 3000, 0);
    const joined = previewVertex(doc, shared.id, { x: 5990, y: 5 }, 1, true);
    expect(joined.document.vertices.some((v) => v.id === shared.id)).toBe(false);
    const free = previewVertex(doc, shared.id, { x: 5990, y: 5 }, 1, true, { free: true });
    expect(free.document.vertices.some((v) => v.id === shared.id)).toBe(true);
  });

  it('al dibujar, ⌘ no se pega a una esquina pero mantiene el trazo ortogonal', () => {
    const doc = corner();
    expect(snapWallPoint(doc, { x: 3010, y: 5 }, 1, true).kind).toBe('vertex');
    const free = snapWallPoint(doc, { x: 3010, y: 5 }, 1, true, { x: 3010, y: -2000 }, { free: true });
    expect(free.kind).not.toBe('vertex');
    expect(free.point.x).toBe(3010);
  });
});

describe('alargar una pared hasta una esquina sin «intersección de muros»', () => {
  it('si al alargarla pasa por la esquina de otra pared, se une ahí en T', () => {
    const doc = addWallPath(addWallPath(emptyEditorDocument(), [{ x: 0, y: 2000 }, { x: 1500, y: 2000 }], false),
      [{ x: 3000, y: 0 }, { x: 3000, y: 2000 }], false);
    const end = at(doc, 1500, 2000), corner = at(doc, 3000, 2000);
    const preview = previewVertex(doc, end.id, { x: 4500, y: 2000 }, 0.1, true);
    expect(preview.error).toBeNull();
    expect(preview.document.walls.filter((w) => w.startVertexId === corner.id || w.endVertexId === corner.id)).toHaveLength(3);
  });

  it('si al soltar se pasa unos centímetros de la pared de destino, se queda en ella unida en T', () => {
    const doc = addWallPath(addWallPath(emptyEditorDocument(), [{ x: 0, y: 1000 }, { x: 2000, y: 1000 }], false),
      [{ x: 3000, y: 0 }, { x: 3000, y: 2000 }], false);
    const end = at(doc, 2000, 1000);
    const preview = previewVertex(doc, end.id, { x: 3200, y: 1000 }, 0.1, true);
    expect(preview.error).toBeNull();
    expect(preview.point).toEqual({ x: 3000, y: 1000 });
    const joint = at(preview.document, 3000, 1000);
    expect(preview.document.walls.filter((w) => w.startVertexId === joint.id || w.endVertexId === joint.id)).toHaveLength(3);
  });

  it('un cruce real se explica en términos de lo que hace el usuario', () => {
    const doc = addWallPath(addWallPath(emptyEditorDocument(), [{ x: 0, y: 1000 }, { x: 2000, y: 1000 }], false),
      [{ x: 3000, y: 0 }, { x: 3000, y: 2000 }], false);
    const preview = previewVertex(doc, at(doc, 2000, 1000).id, { x: 5000, y: 1000 }, 0.1, true);
    expect(preview.error).toMatch(/cruzaría otra pared/);
  });
});

describe('medida tecleada', () => {
  it('lee metros con coma o punto, borra con Retroceso y fija con Enter', () => {
    let state = { buffer: '' };
    for (const key of ['3', ',', '2', '5']) state = typedLengthKey(state.buffer, key);
    expect(state.buffer).toBe('3,25');
    expect(typedLengthKey('3,25', 'Backspace').buffer).toBe('3,2');
    expect(typedLengthKey('3,25', 'Enter')).toMatchObject({ consumed: true, commitMm: 3250, buffer: '' });
    expect(typedLengthKey('', '.').buffer).toBe('0,');
    // Sin medida empezada, las letras y Esc siguen siendo atajos.
    expect(typedLengthKey('', 'Escape').consumed).toBe(false);
    expect(typedLengthKey('', 'b').consumed).toBe(false);
  });

  it('coloca el punto a esa distancia en la dirección del ratón', () => {
    expect(pointAtLength({ x: 0, y: 0 }, { x: 0, y: 10 }, 3250)).toEqual({ x: 0, y: 3250 });
  });
});

describe('Alt + doble clic en una pared y pistas', () => {
  it('añade una esquina y deja seleccionados los dos tramos', () => {
    const store = createEditorStore(corner()), wall = store.getState().document.walls[0]!;
    expect(store.getState().addCornerAt(wall.id, { x: 1500, y: 0 }, 1)).toBe(true);
    const { document, selection } = store.getState();
    expect(document.walls).toHaveLength(3);
    expect(selection).toHaveLength(2);
    expect(selection).toContain(wall.id);
  });

  it('las pistas dicen las teclas de lo que se está haciendo', () => {
    const doc = corner();
    expect(editorHint('wall', [], doc, true, '⌘')).toMatch(/teclea una medida.*mantén ⌘ para no pegarte/);
    expect(editorHint('select', [doc.walls[0]!.id], doc, false, 'Ctrl')).toMatch(/mantén Ctrl para alargar solo esta pared.*doble clic: propiedades · Alt \+ doble clic: añadir esquina/);
    expect(editorHint('select', [], doc, false)).toMatch(/Alt \+ doble clic en una pared: añadir esquina/);
  });
});
