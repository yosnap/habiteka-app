/**
 * En la prueba en la aplicación las dos camas quedaron con el cabecero bajo la ventana y el mueble de la tele de lado
 * respecto al sofá. Amueblar pasa la cama a una pared ciega y pone la tele en la pared de enfrente del sofá.
 */
import { describe, expect, it } from 'vitest';
import { addOpening, addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { roomWallFaces } from '@/lib/editor-document/room-wall-faces';
import { parseNativeDesignProposal } from '@/server/agent/editor-v2/native-design-proposal';
import { applyNativeDesignProposal } from '@/lib/editor-document/native-design-proposal';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { isTelevision } from '@/lib/editor-document/native-design-seating';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';

// Estancia de 5000 × 4000 con una ventana en el muro de arriba.
const room = () => {
  const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 4000 }, { x: 0, y: 4000 }], true);
  const vertex = (id: string) => doc.vertices.find((item) => item.id === id)!;
  const top = doc.walls.find((wall) => vertex(wall.startVertexId).y === 0 && vertex(wall.endVertexId).y === 0)!;
  return addOpening(doc, top.id, { x: 2500, y: 0 }, 'ventana');
};
const options = { ...defaultRenderDesignOptions(), freedom: 'free' as const, designScope: 'all' as const };
const wallId = (doc: ReturnType<typeof room>, side: string) => roomWallFaces(doc, deriveRooms(doc)[0]!, 'E1', []).find((face) => face.side === side)!.id;
const answer = (furniture: unknown[]) => ({ summary: '', materials: {}, roomFinishes: [], kitchens: [], fixedFinishes: [], furniture });

describe('distribución de Amueblar', () => {
  it('conserva la televisión existente sin añadir otra por el mueble ni por una petición directa', () => {
    const doc = upgradeSpatialDocument(room()), tv = getFurnitureCatalogEntry('habiteka:furniture:televisor')!;
    const existing = { id: 'tv-original', kind: tv.kind, catalogId: tv.id, x: 2000, y: 2800, widthMm: tv.widthMm,
      depthMm: tv.depthMm, heightMm: tv.heightMm, dimensionalOrigin: 'physical' as const, elevationMm: 500, rotation: 0, color: tv.color };
    doc.furniture.push(existing);
    const proposal = parseNativeDesignProposal(answer([
      { catalogId: 'habiteka:furniture:mueble-tv', wall: wallId(doc, 'derecha'), alongMm: 2000, cxMm: 0, cyMm: 0, rotation: 0, reason: '' },
      { catalogId: tv.id, cxMm: 1000, cyMm: 1800, rotation: 0, reason: '' },
    ]), 'moderno', doc, options);
    expect(proposal.furniture.some(item => isTelevision(getFurnitureCatalogEntry(item.catalogId)))).toBe(false);
    // La aplicación también protege propuestas antiguas que ya traían el duplicado.
    proposal.furniture.push({ catalogId: tv.id, xMm: 1000, yMm: 1800, rotation: 0, reason: '' });
    const applied = applyNativeDesignProposal(doc, proposal);
    expect(applied.furniture.filter(item => isTelevision(getFurnitureCatalogEntry(item.catalogId ?? '')))).toEqual([existing]);
  });

  it('permite una televisión en otra estancia y limita varios acompañantes de la misma propuesta', () => {
    const doc = upgradeSpatialDocument(addWallPath(room(), [{ x: 7000, y: 0 }, { x: 12000, y: 0 }, { x: 12000, y: 4000 }, { x: 7000, y: 4000 }], true));
    const tv = getFurnitureCatalogEntry('habiteka:furniture:televisor')!;
    doc.furniture.push({ id: 'tv-original', kind: tv.kind, catalogId: tv.id, x: 2000, y: 2800,
      widthMm: tv.widthMm, depthMm: tv.depthMm, heightMm: tv.heightMm, dimensionalOrigin: 'physical', elevationMm: 500, rotation: 0, color: tv.color });
    const rooms = deriveRooms(doc), secondIndex = rooms.findIndex(item => item.boundary.every(point => point.x >= 7000));
    const faces = roomWallFaces(doc, rooms[secondIndex]!, `E${secondIndex + 1}`, []);
    const proposal = parseNativeDesignProposal(answer(['derecha', 'izquierda'].map(side => ({
      catalogId: 'habiteka:furniture:mueble-tv', wall: faces.find(face => face.side === side)!.id,
      alongMm: 2000, cxMm: 0, cyMm: 0, rotation: 0, reason: '',
    }))), 'moderno', doc, options);
    expect(proposal.furniture.filter(item => isTelevision(getFurnitureCatalogEntry(item.catalogId)))).toHaveLength(1);
    expect(applyNativeDesignProposal(doc, proposal).furniture.filter(item => isTelevision(getFurnitureCatalogEntry(item.catalogId ?? '')))).toHaveLength(2);
  });
  it('saca el cabecero de debajo de la ventana a una pared ciega', () => {
    const doc = room();
    const bed = parseNativeDesignProposal(answer([{ catalogId: 'habiteka:furniture:cama-doble', wall: wallId(doc, 'arriba'), alongMm: 2500, cxMm: 0, cyMm: 0, rotation: 0, reason: '' }]),
      'moderno', doc, options).furniture.find((item) => item.catalogId === 'habiteka:furniture:cama-doble')!;
    expect(bed.rotation).not.toBe(0);
  });

  it('pone el mueble de la tele en la pared de enfrente del sofá', () => {
    const doc = room();
    const proposal = parseNativeDesignProposal(answer([
      { catalogId: 'habiteka:furniture:sofa-3', wall: wallId(doc, 'izquierda'), alongMm: 2000, cxMm: 0, cyMm: 0, rotation: 0, reason: '' },
      { catalogId: 'habiteka:furniture:mueble-tv', wall: wallId(doc, 'abajo'), alongMm: 2500, cxMm: 0, cyMm: 0, rotation: 0, reason: '' },
    ]), 'moderno', doc, options);
    const sofa = proposal.furniture.find((item) => item.catalogId === 'habiteka:furniture:sofa-3')!;
    const tv = proposal.furniture.find((item) => item.catalogId === 'habiteka:furniture:mueble-tv')!;
    expect([sofa.rotation, tv.rotation]).toEqual([270, 90]);
  });

  it('pone el televisor encima de su mueble de TV', () => {
    const doc = room();
    const proposal = parseNativeDesignProposal(answer([{ catalogId: 'habiteka:furniture:mueble-tv', wall: wallId(doc, 'derecha'), alongMm: 2000, cxMm: 0, cyMm: 0, rotation: 0, reason: '' }]),
      'moderno', doc, options);
    const applied = applyNativeDesignProposal(doc, proposal);
    const unit = applied.furniture.find((item) => item.catalogId === 'habiteka:furniture:mueble-tv')!;
    const tv = applied.furniture.find((item) => item.catalogId === 'habiteka:furniture:televisor')!;
    expect(tv).toMatchObject({ hostId: unit.id, elevationMm: 500, rotation: unit.rotation });
  });
});
