import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type EditorDocument, type Opening } from '@/lib/editor-document/schema';
import { addOpening, addWallPath } from '@/canvas/editor-v2/editing-operations';
import { OPENING_TYPES, leafReachMm, openingControls, openingType, openingTypesFor } from '@/lib/editor-document/opening-types';
import { applyDefaultDoorType, defaultDoorTypeId, setOpeningType } from '@/lib/editor-document/opening-type-commands';
import { openingMeshes } from '@/canvas/editor-v2/scene/opening-meshes';
import { openingConstruction } from '@/lib/editor-document/construction-properties';
import { upgradeConstructionDocument } from '@/lib/editor-document/migrations';
import { placeOpening } from '@/canvas/editor-v2/opening-placement';
import { doorClearZones } from '@/lib/editor-document/native-design-proposal';
import { wallPath } from '@/lib/editor-document/wall-path';
import { meters } from '@/canvas/editor-v2/scene/types';

/** Dos estancias de 3 × 4 m: perímetro de fachada y un tabique central (w6) entre ellas. */
function house(): EditorDocument {
  const doc = emptyEditorDocument();
  doc.vertices = [
    { id: 'a', x: 0, y: 0 }, { id: 'b', x: 3000, y: 0 }, { id: 'c', x: 6000, y: 0 },
    { id: 'd', x: 6000, y: 4000 }, { id: 'e', x: 3000, y: 4000 }, { id: 'f', x: 0, y: 4000 },
  ];
  doc.walls = [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f'], ['f', 'a'], ['b', 'e']].map(([a, b], i) => ({
    id: `w${i}`, startVertexId: a!, endVertexId: b!, thicknessMm: 150, dimensionalOrigin: 'physical' as const,
  }));
  return doc;
}

const straightDoc = (length = 6000) => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: length, y: 0 }]);
/** Muro recto con una abertura en `x`; el documento es v2, sin campos de construcción, como uno antiguo. */
function withOpening(kind: Opening['kind'], x: number, length = 6000) {
  const doc = straightDoc(length);
  return addOpening(doc, doc.walls[0]!.id, { x, y: 0 }, kind);
}

/** El modelo de hoja anterior a los tipos, copiado tal cual para comprobar que no cambia ni un decimal. */
function historicLeaf(doc: EditorDocument, opening: Opening) {
  const wall = doc.walls.find((item) => item.id === opening.wallId)!, path = wallPath(doc, wall);
  const a = path.at(opening.position), direction = path.tangent(opening.position), angle = Math.atan2(direction.y, direction.x);
  const p = openingConstruction(opening), width = opening.widthMm, frame = Math.min(45, width / 8, p.heightMm / 8);
  const leafWidth = width - 2 * frame, hinge = p.hinge === 'left' ? -1 : 1;
  const delta = p.hinge === 'left' ? (p.swing === 'left' ? 1 : -1) * p.openAngleDeg * Math.PI / 180
    : Math.PI - (p.swing === 'left' ? 1 : -1) * p.openAngleDeg * Math.PI / 180;
  const x = hinge * leafWidth / 2 + Math.cos(delta) * leafWidth / 2, z = Math.sin(delta) * leafWidth / 2;
  return { position: [meters(a.x + Math.cos(angle) * (0 + x) - Math.sin(angle) * z), meters(p.elevationMm + (p.heightMm - frame) / 2),
    meters(a.y + Math.sin(angle) * (0 + x) + Math.cos(angle) * z)], size: [meters(leafWidth), meters(p.heightMm - frame), meters(38)],
  rotation: -(angle + delta) };
}

describe('registro de tipos de puerta y ventana', () => {
  it('tiene ids únicos, nombre en español y medidas por defecto coherentes con su clase', () => {
    expect(new Set(OPENING_TYPES.map((type) => type.id)).size).toBe(OPENING_TYPES.length);
    for (const type of OPENING_TYPES) {
      expect(type.id.startsWith(`${type.kind}-`)).toBe(true);
      expect(type.name.trim().length).toBeGreaterThan(3);
      expect(type.widthMm).toBeGreaterThan(0);
      expect(type.heightMm).toBeGreaterThan(0);
      expect(type.leaves).toBeGreaterThanOrEqual(1);
      // Solo las hojas abatibles barren un arco; correderas, plegables y fijas no.
      expect(type.swings).toBe(type.operation === 'abatible');
    }
    expect(openingTypesFor('puerta').map((type) => type.id)).toEqual(expect.arrayContaining([
      'puerta-basic', 'puerta-entrada', 'puerta-doble', 'puerta-corredera', 'puerta-corredera-empotrada',
      'puerta-corredera-vidrio', 'puerta-plegable', 'puerta-vidriera']));
    expect(openingTypesFor('ventana').map((type) => type.id)).toEqual(expect.arrayContaining([
      'ventana-basic', 'ventana-abatible', 'ventana-abatible-doble', 'ventana-corredera', 'ventana-balconera', 'ventana-fija']));
    expect(openingType({ kind: 'ventana', catalogId: 'ventana-balconera' })).toMatchObject({ elevationMm: 0, heightMm: 2100 });
    expect(openingType({ kind: 'puerta', catalogId: 'puerta-entrada' })!.widthMm).toBeGreaterThanOrEqual(900);
    expect(openingType({ kind: 'puerta', catalogId: 'puerta-entrada' })!.widthMm).toBeLessThanOrEqual(1000);
    expect(openingType({ kind: 'puerta', catalogId: 'puerta-corredera-vidrio' })).toMatchObject({ glazed: true, swings: false });
  });

  it('resuelve documentos antiguos, ids desconocidos o de otra clase al tipo básico; un hueco no tiene tipo', () => {
    expect(openingType({ kind: 'puerta' })!.id).toBe('puerta-basic');
    expect(openingType({ kind: 'ventana', catalogId: 'ventana-basic' })!.id).toBe('ventana-basic');
    expect(openingType({ kind: 'puerta', catalogId: 'puerta-inexistente' })!.id).toBe('puerta-basic');
    expect(openingType({ kind: 'ventana', catalogId: 'puerta-doble' })!.id).toBe('ventana-basic');
    expect(openingType({ kind: 'hueco', catalogId: 'hueco-basic' })).toBeNull();
  });

  it('ofrece solo los controles que tienen sentido para cada tipo', () => {
    expect(openingControls(openingType({ kind: 'puerta' }))).toEqual({ angle: true, toggle: true, hinge: 'Cambiar bisagra', swing: 'Invertir apertura' });
    expect(openingControls(openingType({ kind: 'puerta', catalogId: 'puerta-doble' })).hinge).toBeNull();
    const sliding = openingControls(openingType({ kind: 'puerta', catalogId: 'puerta-corredera' }));
    expect(sliding).toMatchObject({ angle: false, toggle: true });
    expect(sliding.hinge).toMatch(/lado/);
    expect(openingControls(openingType({ kind: 'ventana' }))).toEqual({ angle: false, toggle: false, hinge: null, swing: null });
  });

  it('calcula cuánto sale la hoja del muro según su tipo', () => {
    expect(leafReachMm({ kind: 'puerta', widthMm: 900 })).toBe(900);
    expect(leafReachMm({ kind: 'puerta', catalogId: 'puerta-doble', widthMm: 1400 })).toBe(700);
    expect(leafReachMm({ kind: 'puerta', catalogId: 'puerta-corredera-empotrada', widthMm: 800 })).toBe(0);
    expect(leafReachMm({ kind: 'puerta', catalogId: 'puerta-plegable', widthMm: 800 })).toBe(200);
  });
});

describe('compatibilidad con documentos sin tipo', () => {
  it('una puerta sin catalogId genera exactamente el mismo modelo que la básica y que el modelo histórico', () => {
    const doc = withOpening('puerta', 2500);
    const legacy = doc.openings[0]!;
    expect(legacy.catalogId).toBeUndefined();
    for (const hinge of ['left', 'right'] as const) for (const swing of ['left', 'right'] as const) for (const openAngleDeg of [0, 35, 90]) {
      const opening = { ...legacy, hinge, swing, openAngleDeg };
      const boxes = openingMeshes(doc, opening);
      expect(boxes).toEqual(openingMeshes(doc, { ...opening, catalogId: 'puerta-basic' }));
      expect(boxes.map((box) => box.role)).toEqual(['frame', 'frame', 'frame', 'leaf']);
      expect(boxes[3]).toMatchObject(historicLeaf(doc, opening));
    }
  });

  it('la ventana sin catalogId conserva marco, montante, vidrio y juntas, y se migra como básica', () => {
    const doc = withOpening('ventana', 2500);
    const boxes = openingMeshes(doc, doc.openings[0]!);
    expect(boxes).toEqual(openingMeshes(doc, { ...doc.openings[0]!, catalogId: 'ventana-basic' }));
    expect(boxes.filter((box) => box.role === 'frame')).toHaveLength(5);
    expect(boxes.filter((box) => box.role === 'glass')).toHaveLength(1);
    expect(upgradeConstructionDocument(doc).openings[0]!.catalogId).toBe('ventana-basic');
  });
});

describe('cambiar el tipo de una abertura', () => {
  it('aplica las medidas por defecto cuando caben', () => {
    const doc = withOpening('puerta', 3000);
    const next = setOpeningType(doc, doc.openings[0]!.id, 'puerta-corredera-vidrio');
    expect(next.openings[0]).toMatchObject({ catalogId: 'puerta-corredera-vidrio', widthMm: 1800, heightMm: 2100, elevationMm: 0 });
    const windowDoc = withOpening('ventana', 3000);
    const balcony = setOpeningType(windowDoc, windowDoc.openings[0]!.id, 'ventana-balconera');
    expect(balcony.openings[0]).toMatchObject({ catalogId: 'ventana-balconera', widthMm: 1200, heightMm: 2100, elevationMm: 0 });
  });

  it('conserva el ancho si el del tipo no cabe en el muro, sin renunciar al tipo', () => {
    const doc = withOpening('puerta', 600, 1200);
    const next = setOpeningType(doc, doc.openings[0]!.id, 'puerta-corredera-vidrio');
    expect(next.openings[0]).toMatchObject({ catalogId: 'puerta-corredera-vidrio', widthMm: 900 });
  });

  it('rechaza un tipo de otra clase', () => {
    const doc = withOpening('puerta', 3000);
    expect(() => setOpeningType(doc, doc.openings[0]!.id, 'ventana-fija')).toThrow(/no corresponde/);
  });
});

describe('puerta de entrada por defecto en fachada', () => {
  it('se ofrece en un muro de fachada y no en un tabique ni en la pared de un patio', () => {
    const doc = house();
    expect(defaultDoorTypeId(doc, 'w0')).toBe('puerta-entrada');
    expect(defaultDoorTypeId(doc, 'w6')).toBe('puerta-basic');
    // Un documento nuevo, como tras cada edición: la fachada se calcula una vez por documento.
    const patio = structuredClone(doc);
    patio.vertices.push({ id: 'g', x: 6000, y: 6000 }, { id: 'h', x: 0, y: 6000 });
    patio.walls.push(...([['d', 'g'], ['g', 'h'], ['h', 'f']] as const).map(([a, b], i) => ({
      id: `hidden:patio:${i}`, startVertexId: a, endVertexId: b, thicknessMm: 80, dimensionalOrigin: 'physical' as const, hidden: true })));
    expect(defaultDoorTypeId(patio, 'w3')).toBe('puerta-basic');
    expect(defaultDoorTypeId(patio, 'w0')).toBe('puerta-entrada');
  });

  it('al colocarla en fachada queda como puerta de entrada con su ancho si cabe', () => {
    const doc = house(), prototype: Opening = { id: 'door', kind: 'puerta', wallId: '', position: .5, widthMm: 900, dimensionalOrigin: 'physical' };
    const placed = placeOpening(doc, prototype, { wallId: 'w0', position: .5 });
    expect(placed.openings[0]!.catalogId).toBe('puerta-basic');
    expect(applyDefaultDoorType(doc, placed, 'door', 'w0').openings[0]).toMatchObject({ catalogId: 'puerta-entrada', widthMm: 950 });
    const inner = placeOpening(doc, prototype, { wallId: 'w6', position: .5 });
    expect(applyDefaultDoorType(doc, inner, 'door', 'w6')).toBe(inner);
  });
});

describe('zona libre de cada puerta al amueblar', () => {
  it('una corredera empotrada reserva menos fondo y una vista reserva el tramo donde se recoge', () => {
    const base = upgradeConstructionDocument(withOpening('puerta', 3000));
    const zone = (catalogId: string) => {
      const doc = structuredClone(base); doc.openings[0]!.catalogId = catalogId;
      const box = doorClearZones(doc)[0]!;
      return { depth: box.maxY - box.minY, width: box.maxX - box.minX, minX: box.minX };
    };
    const basic = zone('puerta-basic'), pocket = zone('puerta-corredera-empotrada'), sliding = zone('puerta-corredera');
    expect(pocket.depth).toBeLessThan(basic.depth);
    expect(pocket.width).toBeCloseTo(basic.width);
    expect(sliding.width).toBeCloseTo(basic.width + 900);
    expect(sliding.minX).toBeCloseTo(basic.minX - 900);
  });
});
