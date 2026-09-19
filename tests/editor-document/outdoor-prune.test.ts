import { expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { addOutdoorEdge, addOutdoorArea } from '@/lib/editor-document/outdoor-area';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { pruneOrphanOutdoorEdges } from '@/lib/editor-document/outdoor-prune';
import { createEditorStore } from '@/canvas/editor-v2/store';

it('retira restos de contornos de patio que cruzan muros o quedan dentro de estancias, y respeta un trazado abierto', () => {
  // Resto de un patio antiguo: tres tramos abiertos que cruzan por donde luego se construye el hall.
  let doc = addOutdoorEdge(emptyEditorDocument(), { x: 1000, y: 4000 }, { x: 1000, y: 6000 });
  doc = addOutdoorEdge(doc, { x: 1000, y: 6000 }, { x: 5000, y: 6000 });
  // Trazado abierto legítimo en zona libre, lejos de todo.
  doc = addOutdoorEdge(doc, { x: 20000, y: 20000 }, { x: 24000, y: 20000 });
  doc = addWallPath(doc, [{ x: 0, y: 3000 }, { x: 4000, y: 3000 }, { x: 4000, y: 7000 }, { x: 0, y: 7000 }], true);
  expect(deriveRooms(doc)).toHaveLength(1);
  const pruned = pruneOrphanOutdoorEdges(doc);
  const outdoor = pruned.walls.filter((w) => w.id.startsWith('outdoor:'));
  expect(outdoor).toHaveLength(1);
  expect(pruned.vertices.some((v) => v.x === 20000)).toBe(true);
  expect(pruned.vertices.some((v) => v.x === 1000 && v.y === 4000)).toBe(false);
});

it('conserva los bordes de un patio cerrado y limpia al aplicar una edición en el editor', () => {
  let doc = addOutdoorArea(emptyEditorDocument(), { x: 0, y: 0 }, { x: 6000, y: 4000 });
  const before = doc.walls.length;
  expect(pruneOrphanOutdoorEdges(doc).walls).toHaveLength(before);
  // Un tramo suelto dentro del patio queda como resto invisible; la siguiente edición lo retira.
  doc = addOutdoorEdge(doc, { x: 1000, y: 1000 }, { x: 2000, y: 1000 });
  const store = createEditorStore(doc);
  store.getState().apply(addWallPath(store.getState().document, [{ x: 10000, y: 0 }, { x: 12000, y: 0 }], false));
  expect(store.getState().document.walls.filter((w) => w.id.startsWith('outdoor:'))).toHaveLength(4);
});
