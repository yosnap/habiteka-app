/**
 * La IA amuebla con el centro de cada pieza, cuatro giros y el suelo útil de cada estancia. Con la esquina y el eje de
 * los muros, todo lo arrimado a una pared o girado se descartaba: de 43 muebles propuestos quedaban 10.
 */
import { describe, expect, it } from 'vitest';
import { addOpening, addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { upgradeSpatialDocument, footprint } from '@/lib/editor-document/spatial-properties';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { roomInterior } from '@/lib/editor-document/room-interior';
import { fromModelFurniture, snapRotation, toModelFurniture } from '@/lib/editor-document/proposal-coordinates';
import { nativeFurniturePlacementIssue } from '@/lib/editor-document/native-design-proposal';

const BED = getFurnitureCatalogEntry('habiteka:furniture:cama-doble')!;
// Habitación de 5000 × 4000 con muros de 150 mm: el suelo útil va de 75 a 4925 en x y de 75 a 3925 en y.
const room = () => upgradeSpatialDocument(addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 4000 }, { x: 0, y: 4000 }], true));
const box = (item: Parameters<typeof toModelFurniture>[0]) => {
  const points = footprint({ x: item.xMm, y: item.yMm, rotation: item.rotation, widthMm: BED.widthMm, depthMm: BED.depthMm });
  const xs = points.map((point) => Math.round(point.x)), ys = points.map((point) => Math.round(point.y));
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const;
};

describe('coordenadas de la propuesta', () => {
  it('el centro se conserva con los cuatro giros y la huella se gira sobre él', () => {
    for (const rotation of [0, 90, 180, 270]) {
      const placed = fromModelFurniture({ catalogId: BED.id, cxMm: 2500, cyMm: 2000, rotation, reason: '' })!;
      expect(toModelFurniture(placed)).toMatchObject({ cxMm: 2500, cyMm: 2000, rotation });
      const [minX, minY, maxX, maxY] = box(placed), across = rotation % 180 ? BED.depthMm : BED.widthMm;
      expect([maxX - minX, (minX + maxX) / 2, (minY + maxY) / 2]).toEqual([across, 2500, 2000]);
    }
    expect([snapRotation(-90), snapRotation(268), snapRotation(360)]).toEqual([270, 270, 0]);
  });

  it('una cama girada contra el muro derecho cabe si toca su cara interior', () => {
    const doc = room(), face = 4925;
    const bed = fromModelFurniture({ catalogId: BED.id, cxMm: face - BED.depthMm / 2, cyMm: 2000, rotation: 90, reason: '' })!;
    expect(box(bed)[2]).toBe(face);
    expect(nativeFurniturePlacementIssue(doc, bed)).toBeNull();
    // Arrimada al eje del muro, la mitad del grueso queda dentro de la pared.
    expect(nativeFurniturePlacementIssue(doc, fromModelFurniture({ catalogId: BED.id, cxMm: 5000 - BED.depthMm / 2, cyMm: 2000, rotation: 90, reason: '' })!))
      .not.toBeNull();
  });

  it('el suelo útil descuenta medio grueso de cada muro', () => {
    const doc = room(), [space] = deriveRooms(doc);
    const xs = roomInterior(doc, space!).map((point) => Math.round(point.x)), ys = roomInterior(doc, space!).map((point) => Math.round(point.y));
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([75, 4925, 75, 3925]);
  });

  it('las sillas tocan la mesa y la alfombra puede ir delante de una puerta', () => {
    const doc = room(), table = getFurnitureCatalogEntry('habiteka:furniture:mesa-comedor')!, chair = getFurnitureCatalogEntry('habiteka:furniture:silla-comedor')!;
    doc.furniture.push({ id: 'mesa', kind: table.kind, catalogId: table.id, x: 1500, y: 1500, widthMm: table.widthMm, depthMm: table.depthMm,
      heightMm: table.heightMm, elevationMm: 0, rotation: 0, dimensionalOrigin: 'physical', color: table.color });
    // Silla al norte de la mesa, mirando hacia ella (trasera arriba) y tocando su borde.
    expect(nativeFurniturePlacementIssue(doc, { catalogId: chair.id, xMm: 1700, yMm: 1500 - chair.depthMm, rotation: 0, reason: '' })).toBeNull();
    const vertex = (id: string) => doc.vertices.find((item) => item.id === id)!;
    const front = doc.walls.find((wall) => vertex(wall.startVertexId).y === 4000 && vertex(wall.endVertexId).y === 4000)!;
    const withDoor = addOpening(doc, front.id, { x: 4000, y: 4000 }, 'puerta');
    expect(nativeFurniturePlacementIssue(withDoor, { catalogId: 'habiteka:furniture:alfombra', xMm: 2500, yMm: 1500, rotation: 0, reason: '' })).toBeNull();
    expect(nativeFurniturePlacementIssue(withDoor, { catalogId: 'habiteka:furniture:butaca', xMm: 3600, yMm: 3000, rotation: 0, reason: '' })).toBe('circulation');
  });
});
