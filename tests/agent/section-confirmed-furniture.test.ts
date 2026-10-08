/**
 * El generador ignoraba «cama vista por detrás» escrito: las camas y sofás se dibujan en la sección solo donde la
 * cenital aceptada y el plano coinciden, porque el diseño aceptado manda y puede haberse rediseñado.
 */
import { describe, expect, it } from 'vitest';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { confirmedSectionFurniture } from '@/server/agent/editor-v2/section-confirmed-furniture';
import { rasterizeEditorElevation } from '@/server/agent/editor-v2/rasterize-editor-elevation';

const room = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }];
function bedroom() {
  const doc = upgradeSpatialDocument(addWallPath(emptyEditorDocument(), room, true));
  doc.labels.push({ id: 'dormitorio', text: 'DORMITORIO', x: 2000, y: 2000 });
  // Sin girar, el cabecero queda al norte y los pies miran al sur.
  doc.furniture.push({ id: 'bed', kind: 'cama-doble', catalogId: 'habiteka:furniture:cama-doble', x: 1200, y: 600, widthMm: 1600,
    depthMm: 2000, heightMm: 900, rotation: 0, elevationMm: 0, color: '#d8cfc0', dimensionalOrigin: 'physical' });
  return doc;
}
const rooms = [{ name: 'DORMITORIO', boundary: room }];

describe('camas confirmadas en la sección', () => {
  it('dibuja la cama cuando la cenital aceptada la ve igual que el plano', () => {
    const doc = bedroom();
    expect(confirmedSectionFurniture(doc, 'back', rooms, [[{ kind: 'bed', facing: 'behind' }]]))
      .toEqual({ ids: ['bed'], lines: ['DORMITORIO: cama vista por detrás, con la trasera del cabecero en primer plano y los pies hacia el fondo'] });
    expect(confirmedSectionFurniture(doc, 'front', rooms, [[{ kind: 'bed', facing: 'front' }]]).ids).toEqual(['bed']);
    expect(confirmedSectionFurniture(doc, 'left', rooms, [[{ kind: 'bed', facing: 'profile-left' }]]).lines)
      .toEqual(['DORMITORIO: cama de perfil, con el cabecero a la izquierda']);
  });

  it('no dibuja nada si la cenital aceptada la orienta de otra forma, tiene otras piezas o no se pudo leer', () => {
    const doc = bedroom();
    expect(confirmedSectionFurniture(doc, 'back', rooms, [[{ kind: 'bed', facing: 'front' }]]).ids).toEqual([]);
    expect(confirmedSectionFurniture(doc, 'back', rooms, [[{ kind: 'bed', facing: 'behind' }, { kind: 'bed', facing: 'behind' }]]).ids).toEqual([]);
    expect(confirmedSectionFurniture(doc, 'back', rooms, [null]).ids).toEqual([]);
  });

  it('la sección con la cama dibujada conserva el encuadre de la sección vacía', async () => {
    const doc = bedroom();
    const empty = await rasterizeEditorElevation(doc, 'back', { cut: true, furniture: false });
    const drawn = await rasterizeEditorElevation(doc, 'back', { cut: true, furnitureIds: new Set(['bed']) });
    expect(drawn).toMatchObject({ width: empty!.width, height: empty!.height });
    expect(drawn!.base64).not.toBe(empty!.base64);
  });
});
