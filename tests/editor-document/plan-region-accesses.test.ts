/**
 * Modo «Estancia» del dibujo de zonas: una escalera o una rampa que no está
 * dentro de ninguna estancia también se puede marcar, por su huella. Si cae
 * dentro de una estancia no se ofrece aparte: ya va con ella.
 */
import { describe, expect, it } from 'vitest';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument, type EditorDocument, type Ramp, type Stair } from '@/lib/editor-document/schema';
import { upgradeRampDocument } from '@/lib/editor-document/spatial-properties';
import { RAMP_LANDING_CATALOG_ID } from '@/lib/editor-document/ramp-kind';
import { planRegionAreas, roomAtPoint } from '@/lib/editor-document/render-region-draw';

const CORNERS = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];

const stair: Stair = {
  id: 'escalera', catalogId: 'builtin:stair-straight', kind: 'straight',
  x: 6000, y: 0, widthMm: 1000, depthMm: 3000, rotation: 0,
  heightMm: 2700, stepCount: 15, elevationMm: 0, materialId: 'concrete-grey', color: '#b9b9b9',
};
const landing: Ramp = {
  id: 'descansillo', catalogId: RAMP_LANDING_CATALOG_ID,
  x: 6000, y: 4000, widthMm: 1200, depthMm: 1200, rotation: 0,
  riseMm: 0, elevationMm: 0, materialId: 'concrete-grey', color: '#b9b9b9',
};

function plan(patch: Partial<EditorDocument> = {}): EditorDocument {
  return { ...upgradeRampDocument(addWallPath(emptyEditorDocument(), CORNERS, true)), ...patch };
}

describe('planRegionAreas', () => {
  it('ofrece la escalera y el descansillo de fuera de la vivienda como partes', () => {
    const areas = planRegionAreas(plan({ stairs: [stair], ramps: [landing] }));
    expect(areas.map((area) => area.roomId)).toEqual(
      expect.arrayContaining(['escalera', 'descansillo']),
    );
    expect(areas.find((area) => area.roomId === 'descansillo')?.name).toBe('Descansillo 1');
  });

  it('un clic sobre la escalera devuelve su huella', () => {
    const areas = planRegionAreas(plan({ stairs: [stair] }));
    const hit = roomAtPoint(areas, { x: 6500, y: 1500 });
    expect(hit?.roomId).toBe('escalera');
    expect(hit?.polygon).toHaveLength(4);
  });

  it('una escalera dentro de una estancia no se ofrece por separado', () => {
    const inside = { ...stair, x: 1000, y: 500, depthMm: 1000 };
    const areas = planRegionAreas(plan({ stairs: [inside] }));
    expect(areas.some((area) => area.roomId === inside.id)).toBe(false);
    expect(roomAtPoint(areas, { x: 1500, y: 1000 })?.roomId).toMatch(/^room:/);
  });

  it('sin escaleras ni rampas solo hay estancias', () => {
    expect(planRegionAreas(plan()).every((area) => area.roomId.startsWith('room:'))).toBe(true);
  });
});
