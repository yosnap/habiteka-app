import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type Furniture } from '@/lib/editor-document/schema';
import { addOpening, addWallPath } from '@/canvas/editor-v2/editing-operations';
import { objectCenter } from '@/lib/editor-document/spatial-properties';
import { viewCutawayHosts } from '@/lib/editor-document/view-cutaway-hosts';

const house = () => addWallPath(emptyEditorDocument(), [
  { x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 6000 }, { x: 0, y: 6000 },
], true);
const dressing = (id: string, center: [number, number], rotation: number, kind = 'cortina'): Furniture => {
  const item: Furniture = { id, kind, catalogId: `habiteka:furniture:${kind}`, x: 0, y: 0,
    widthMm: 1800, depthMm: 180, heightMm: 2400, elevationMm: 0, rotation, color: '#cfc6b8', dimensionalOrigin: 'physical' };
  const offset = objectCenter(item);
  return { ...item, x: center[0] - offset.x, y: center[1] - offset.y };
};

describe('elementos ocultos con el muro de cámara', () => {
  it('asocia cortinas y persianas a los cuatro lados sin editar el diseño', () => {
    const doc = house();
    doc.furniture = [dressing('norte', [4000, 100], 0), dressing('este', [7900, 3000], 90),
      dressing('sur', [4000, 5900], 180, 'persiana-veneciana'), dressing('oeste', [100, 3000], 270)];
    const before = JSON.stringify(doc), hosts = viewCutawayHosts(doc);
    expect([...hosts.values()]).toEqual(doc.walls.map(wall => wall.id));
    expect(JSON.stringify(doc)).toBe(before);
  });
  it('conserva la relación de ventanas y no vincula muebles ni cortinas lejos del muro', () => {
    let doc = house();
    const wall = doc.walls[0]!;
    doc = addOpening(doc, wall.id, { x: 4000, y: 0 }, 'ventana');
    doc.furniture = [dressing('lejos', [4000, 3000], 0), dressing('silla', [4000, 100], 0, 'silla'),
      dressing('perpendicular', [4000, 100], 90)];
    expect([...viewCutawayHosts(doc)]).toEqual([[doc.openings[0]!.id, wall.id]]);
  });
  it('asocia al muro interior más cercano y excluye muros ocultos', () => {
    const doc = addWallPath(house(), [{ x: 1000, y: 3000 }, { x: 7000, y: 3000 }], false);
    doc.furniture = [dressing('interior', [4000, 3100], 0)];
    const wall = doc.walls.at(-1)!;
    expect(viewCutawayHosts(doc).get('interior')).toBe(wall.id);
    wall.hidden = true;
    expect(viewCutawayHosts(doc).has('interior')).toBe(false);
  });
});
