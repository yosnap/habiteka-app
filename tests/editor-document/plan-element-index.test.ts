import { expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { addOutdoorArea } from '@/lib/editor-document/outdoor-area';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { matchesQuery, planElementIndex } from '@/lib/editor-document/plan-element-index';

it('indexa estancias, paredes y textos con nombre legible y punto para centrar', () => {
  const house = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }], true);
  const doc = addOutdoorArea(house, { x: 4000, y: 0 }, { x: 7000, y: 3000 });
  doc.walls[0]!.name = 'Fachada norte';
  const index = planElementIndex(doc, deriveRooms(doc));
  expect(index.filter((e) => e.group === 'Estancias')).toHaveLength(2);
  expect(index.find((e) => e.label === 'Patio / terraza')?.point).toEqual({ x: 5500, y: 1500 });
  expect(index.find((e) => e.label === 'Fachada norte')?.point).toEqual({ x: 2000, y: 0 });
  // Los tramos ocultos del patio no son elementos que buscar.
  expect(index.filter((e) => e.group === 'Paredes')).toHaveLength(4);
  expect(index.filter((e) => e.group === 'Textos')).toHaveLength(0);
});

it('la búsqueda ignora acentos y mayúsculas y admite varias palabras', () => {
  const entry = { id: 'x', label: 'Fachada norte', group: 'Paredes', point: { x: 0, y: 0 } };
  expect(matchesQuery(entry, 'FACHADA')).toBe(true);
  expect(matchesQuery(entry, 'pared nórte')).toBe(true);
  expect(matchesQuery(entry, 'patio')).toBe(false);
});
