/**
 * Tipos nuevos de puerta y ventana (granero, corredera central, elevadora, pivotante, vidrio templado, hoja y media,
 * vaivén, seccional; oscilobatiente, guillotina, tres hojas, montante y ventanal fijo), sus medidas reales y el aspecto
 * elegible (diseño, acabado, tirador y marco) sin cambiar los documentos existentes.
 */
import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type EditorDocument, type Opening } from '@/lib/editor-document/schema';
import { addOpening, addWallPath } from '@/canvas/editor-v2/editing-operations';
import { assertOpeningTypeWidth, leafReachMm, openingControls, openingType, openingTypesFor, OPENING_TYPES, slideParkingMm }
  from '@/lib/editor-document/opening-types';
import { leafEnds, openingLeafLayout } from '@/lib/editor-document/opening-leaves';
import { openingSymbol, type SymbolStroke } from '@/lib/editor-document/opening-symbol';
import { openingLook, openingLookControls, openingTypeLookPatch } from '@/lib/editor-document/opening-look';
import { setOpeningLook, setOpeningType } from '@/lib/editor-document/opening-type-commands';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { upgradeConstructionDocument } from '@/lib/editor-document/migrations';
import { paintElement } from '@/lib/editor-document/spatial-commands';
import { doorSweepSolids } from '@/canvas/editor-v2/door-sweep-solids';
import { doorClearZones } from '@/lib/editor-document/native-design-proposal';
import { spatialOpenings } from '@/server/agent/editor-v2/spatial-opening-geometry';

const NEW_DOORS = ['puerta-granero', 'puerta-corredera-central', 'puerta-corredera-elevadora', 'puerta-pivotante', 'puerta-cristal',
  'puerta-entrada-hoja-media', 'puerta-vaiven', 'puerta-garaje', 'puerta-garaje-enrollable', 'puerta-garaje-basculante',
  'puerta-garaje-corredera', 'puerta-garaje-batiente', 'puerta-exterior-corredera'];
const NEW_WINDOWS = ['ventana-oscilobatiente', 'ventana-guillotina', 'ventana-tres-hojas', 'ventana-montante', 'ventana-fija-suelo'];

const item = (catalogId: string, extra: Partial<Opening> = {}): Opening => {
  const type = OPENING_TYPES.find((entry) => entry.id === catalogId)!;
  return { id: 'o', wallId: 'wall', kind: type.kind, position: .5, widthMm: type.widthMm, dimensionalOrigin: 'physical', catalogId,
    heightMm: type.heightMm, elevationMm: type.elevationMm, hinge: 'left', swing: 'left', openAngleDeg: type.kind === 'puerta' ? 90 : 0, ...extra };
};

/** Muro de 8 m y 200 mm sobre el eje x; la cara de apertura «left» queda hacia y positivas. */
function wallWith(opening: Opening, length = 8000): EditorDocument {
  return { ...emptyEditorDocument(), schemaVersion: 3, vertices: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: length, y: 0 }],
    walls: [{ id: 'wall', startVertexId: 'a', endVertexId: 'b', thicknessMm: 200, heightMm: 2700,
      materials: { left: 'plaster-white', right: 'plaster-white' }, dimensionalOrigin: 'physical' }],
    openings: [opening], furniture: [], stairs: [] };
}
const count = (strokes: SymbolStroke[], role: SymbolStroke['role']) => strokes.filter((stroke) => stroke.role === role).length;
const ys = (points: { y: number }[]) => points.map((point) => point.y);

describe('registro de tipos nuevos', () => {
  it('añade las puertas y ventanas pedidas con medidas por defecto dentro de su máximo real', () => {
    expect(openingTypesFor('puerta').map((type) => type.id)).toEqual(expect.arrayContaining(NEW_DOORS));
    expect(openingTypesFor('ventana').map((type) => type.id)).toEqual(expect.arrayContaining(NEW_WINDOWS));
    for (const type of OPENING_TYPES) {
      expect(type.widthMm).toBeLessThanOrEqual(type.maxWidthMm);
      expect(type.legacy ?? false).toBe(![...NEW_DOORS, ...NEW_WINDOWS].includes(type.id));
      // El aspecto con el que se coloca solo usa lo que el tipo admite.
      const controls = openingLookControls(type), patch = openingTypeLookPatch(type);
      if (patch.leafDesign) expect(controls.design).toBe(true);
      if (patch.handle) expect(controls.handle).toBe(true);
      if (patch.frameFinish) expect(controls.frameFinish).toBe(true);
    }
    expect(openingType({ kind: 'puerta', catalogId: 'puerta-corredera-elevadora' })).toMatchObject({ leaves: 4, glazed: true, maxWidthMm: 4000 });
    expect(openingType({ kind: 'puerta', catalogId: 'puerta-garaje' })).toMatchObject({ operation: 'seccional', widthMm: 2500, swings: false });
    expect(openingType({ kind: 'ventana', catalogId: 'ventana-fija-suelo' })).toMatchObject({ operation: 'fija', elevationMm: 0 });
    expect(() => assertOpeningTypeWidth(openingType({ kind: 'puerta', catalogId: 'puerta-pivotante' }), 1700)).toThrow(/máximo 1,60 m/);
    expect(() => assertOpeningTypeWidth(openingType({ kind: 'puerta', catalogId: 'puerta-pivotante' }), 1600)).not.toThrow();
  });

  it('ofrece los controles de cada tipo nuevo', () => {
    const controls = (catalogId: string) => openingControls(openingType({ kind: catalogId.startsWith('ventana') ? 'ventana' : 'puerta', catalogId }));
    expect(controls('puerta-entrada-hoja-media').hinge).toBe('Cambiar bisagra');
    expect(controls('puerta-corredera-central')).toMatchObject({ hinge: null, swing: 'Cambiar cara del muro', toggle: true });
    expect(controls('puerta-corredera-elevadora').hinge).toBeNull();
    expect(controls('puerta-garaje')).toEqual({ angle: false, toggle: true, hinge: null, swing: 'Cambiar cara del muro' });
    expect(controls('puerta-vaiven')).toMatchObject({ angle: true, hinge: 'Cambiar bisagra' });
    expect(controls('ventana-guillotina')).toEqual({ angle: false, toggle: false, hinge: null, swing: null });
    expect(controls('puerta-garaje-enrollable')).toEqual(controls('puerta-garaje'));
    expect(controls('puerta-garaje-basculante')).toEqual(controls('puerta-garaje'));
    expect(controls('puerta-garaje-batiente').hinge).toBeNull();
    expect(controls('ventana-tres-hojas').hinge).toBeNull();
  });

  it('calcula el alcance de la hoja y el tramo de pared de cada corredera', () => {
    expect(leafReachMm({ kind: 'puerta', catalogId: 'puerta-pivotante', widthMm: 1000 })).toBeCloseTo(800);
    expect(leafReachMm({ kind: 'puerta', catalogId: 'puerta-entrada-hoja-media', widthMm: 1200 })).toBeCloseTo(840);
    expect(leafReachMm({ kind: 'puerta', catalogId: 'puerta-garaje', widthMm: 2500 })).toBe(0);
    expect(leafReachMm({ kind: 'puerta', catalogId: 'puerta-granero', widthMm: 1000 })).toBe(70);
    expect(slideParkingMm({ kind: 'puerta', catalogId: 'puerta-corredera-central', widthMm: 1400 })).toEqual({ start: 700, end: 700 });
    expect(slideParkingMm({ kind: 'puerta', catalogId: 'puerta-granero', widthMm: 1000, hinge: 'right' })).toEqual({ start: 0, end: 1000 });
    expect(slideParkingMm({ kind: 'puerta', catalogId: 'puerta-pivotante', widthMm: 1000 })).toEqual({ start: 0, end: 0 });
  });
});

describe('geometría de hojas y barrido de cada tipo nuevo', () => {
  it('pivotante: el eje queda a un quinto del canto y el tramo corto barre la otra cara', () => {
    const layout = openingLeafLayout(item('puerta-pivotante', { widthMm: 1000 }), 1000, 200)!, [leaf] = layout.panels;
    expect(leaf!.hinge).toMatchObject({ pivot: { x: -300, y: 0 }, offsetMm: 200 });
    const [back, front] = leafEnds(leaf!);
    expect(back.y).toBeCloseTo(-200);
    expect(front.y).toBeCloseTo(800);
    // El barrido usa la luz entre jambas del 3D (1000 − 2 × 50 mm de marco): 180 mm al otro lado del eje y 720 mm delante.
    const solids = doorSweepSolids(wallWith(item('puerta-pivotante', { widthMm: 1000 })));
    expect(Math.min(...solids.flatMap((solid) => ys(solid.polygon)))).toBeLessThan(-180);
    expect(Math.max(...solids.flatMap((solid) => ys(solid.polygon)))).toBeGreaterThan(720);
    expect(count(openingSymbol(item('puerta-pivotante'), 200), 'arc')).toBe(2);
  });

  it('hoja y media: hoja principal en el lado de la bisagra y hoja estrecha fija sin barrido', () => {
    const left = openingLeafLayout(item('puerta-entrada-hoja-media'), 1000, 200)!;
    expect(left.panels).toHaveLength(2);
    expect(left.panels[0]).toMatchObject({ lengthMm: 700, hinge: { pivot: { x: -500 } } });
    expect(left.panels[1]).toMatchObject({ lengthMm: 300, fixed: true, center: { x: 350, y: 0 } });
    expect(left.panels[1]!.hinge).toBeUndefined();
    const right = openingLeafLayout(item('puerta-entrada-hoja-media', { hinge: 'right' }), 1000, 200)!;
    expect(right.panels[1]!.center.x).toBeCloseTo(-350);
    expect(count(openingSymbol(item('puerta-entrada-hoja-media'), 200), 'arc')).toBe(1);
    const spatial = spatialOpenings(wallWith(item('puerta-entrada-hoja-media')), 'P')[0]!;
    expect(spatial.swingClearance).toBeDefined();
    expect(spatial.secondSwingClearance).toBeUndefined();
  });

  it('vaivén: abre hacia las dos caras y reserva el giro en ambas', () => {
    const doc = wallWith(item('puerta-vaiven'));
    const ys0 = doorSweepSolids(doc).flatMap((solid) => ys(solid.polygon));
    expect(Math.min(...ys0)).toBeLessThan(-600);
    expect(Math.max(...ys0)).toBeGreaterThan(600);
    const symbol = openingSymbol(item('puerta-vaiven'), 200);
    expect(symbol.filter((stroke) => stroke.role === 'arc').map((stroke) => !!stroke.dashed)).toEqual([false, true]);
    expect(spatialOpenings(doc, 'P')[0]!.secondSwingClearance).toBeDefined();
  });

  it('corredera de dos hojas: cerrada se juntan en el centro y abierta cada hoja se recoge a su lado', () => {
    const closed = openingLeafLayout(item('puerta-corredera-central', { openAngleDeg: 0 }), 1400, 200)!;
    expect(closed.panels.map((panel) => leafEnds(panel)[1].x)[0]).toBeCloseTo(0);
    const open = openingLeafLayout(item('puerta-corredera-central'), 1400, 200)!;
    expect(open.panels[0]!.center.x).toBeCloseTo(closed.panels[0]!.center.x - 700);
    expect(open.panels[1]!.center.x).toBeCloseTo(closed.panels[1]!.center.x + 700);
    expect(open.rail!.from.x).toBeCloseTo(-1440);
    expect(open.rail!.to.x).toBeCloseTo(1440);
    const symbol = openingSymbol(item('puerta-corredera-central'), 200);
    expect(count(symbol, 'arrow')).toBe(2);
    expect(count(symbol, 'arc')).toBe(0);
    const doc = upgradeConstructionDocument(wallWith(item('puerta-corredera-central', { position: .5 })));
    const [zone] = doorClearZones(doc);
    expect(zone!.maxX - zone!.minX).toBeGreaterThan(1400 * 2);
  });

  it('corredera elevadora de cuatro hojas: las centrales se abren por delante de las fijas', () => {
    const closed = openingLeafLayout(item('puerta-corredera-elevadora', { openAngleDeg: 0 }), 3200, 200)!;
    const open = openingLeafLayout(item('puerta-corredera-elevadora'), 3200, 200)!;
    expect(open.panels).toHaveLength(4);
    expect(open.panels[0]!.center).toEqual(closed.panels[0]!.center);
    expect(open.panels[1]!.center.x).toBeCloseTo(open.panels[0]!.center.x);
    expect(Math.sign(open.panels[1]!.center.y)).toBe(-Math.sign(open.panels[0]!.center.y));
    expect(doorSweepSolids(wallWith(item('puerta-corredera-elevadora'))).every((solid) => ys(solid.polygon).every((y) => Math.abs(y) <= 100))).toBe(true);
  });

  it('granero: hoja más separada de la pared que la corredera vista, con guía continua', () => {
    const barn = openingLeafLayout(item('puerta-granero', { widthMm: 900 }), 900, 200)!;
    const sliding = openingLeafLayout(item('puerta-corredera'), 900, 200)!;
    expect(barn.panels[0]!.center.y).toBeGreaterThan(sliding.panels[0]!.center.y);
    expect(barn.travel[0]).toBeDefined();
    expect(openingSymbol(item('puerta-granero'), 200).find((stroke) => stroke.role === 'guide')!.dashed).toBe(false);
  });

  it('seccional: panel por la cara interior y guías bajo el techo que no reservan el suelo del garaje', () => {
    const layout = openingLeafLayout(item('puerta-garaje'), 2400, 200)!;
    expect(layout.lift).toBe(1);
    expect(layout.panels[0]!.heightRange).toEqual([1, 1]);
    expect(Math.max(...ys(layout.overhead!))).toBeCloseTo(100 + 2125 + 300);
    const solids = doorSweepSolids(wallWith(item('puerta-garaje', { openAngleDeg: 0 })));
    const overhead = solids.find((solid) => solid.bottom > 2000)!;
    expect(overhead).toMatchObject({ bottom: 2105, top: 2475 });
    const symbol = openingSymbol(item('puerta-garaje'), 200);
    expect(symbol.some((stroke) => stroke.role === 'pocket' && stroke.dashed)).toBe(true);
    expect(count(symbol, 'arrow')).toBe(1);
  });

  it('enrollable: cajón poco profundo sobre el hueco; basculante: abierta sale un tercio a la calle', () => {
    const roller = openingLeafLayout(item('puerta-garaje-enrollable'), 2400, 200)!;
    expect(Math.max(...ys(roller.overhead!))).toBeCloseTo(100 + 300);
    expect(roller.travel).toEqual([]);
    expect(count(openingSymbol(item('puerta-garaje-enrollable'), 200), 'arrow')).toBe(0);
    const tilting = openingLeafLayout(item('puerta-garaje-basculante'), 2400, 200)!;
    expect(Math.min(...ys(tilting.overhead!))).toBeCloseTo(-100 - 700);
    expect(Math.min(...ys(tilting.travel[0]!))).toBeCloseTo(-100 - 700);
    // Abierta, la franja de calle por la que sale la hoja también se reserva.
    const open = doorSweepSolids(wallWith(item('puerta-garaje-basculante')));
    expect(open.some((solid) => solid.bottom === 0 && Math.min(...ys(solid.polygon)) < -700)).toBe(true);
    const closed = doorSweepSolids(wallWith(item('puerta-garaje-basculante', { openAngleDeg: 0 })));
    expect(closed.some((solid) => solid.bottom === 0 && Math.min(...ys(solid.polygon)) < -700)).toBe(false);
  });

  it('ventanas: tres hojas con tres giros, guillotina con dos hojas superpuestas en altura', () => {
    const three = openingLeafLayout(item('ventana-tres-hojas'), 1800, 200)!;
    expect(three.panels.map((panel) => panel.hinge!.pivot.x)).toEqual([-900, -300, 900]);
    expect(three.panels.every((panel) => panel.lengthMm === 600)).toBe(true);
    expect(count(openingSymbol(item('ventana-tres-hojas'), 200), 'arc')).toBe(3);
    const sash = openingLeafLayout(item('ventana-guillotina'), 900, 200)!;
    expect(sash.panels.map((panel) => panel.heightRange)).toEqual([[0, .53], [.47, 1]]);
    expect(count(openingSymbol(item('ventana-guillotina'), 200), 'glass')).toBe(2);
  });
});

describe('cambiar de tipo y elegir aspecto', () => {
  const straight = (length = 8000) => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: length, y: 0 }]);
  const withDoor = (length = 8000) => { const doc = straight(length); return addOpening(doc, doc.walls[0]!.id, { x: length / 2, y: 0 }, 'puerta'); };

  it('aplica medidas y aspecto del tipo cuando caben, y recorta el ancho al máximo si no', () => {
    const doc = withDoor(), id = doc.openings[0]!.id;
    expect(setOpeningType(doc, id, 'puerta-garaje').openings[0]).toMatchObject({ catalogId: 'puerta-garaje', widthMm: 2500, heightMm: 2125,
      leafFinish: 'antracita' });
    expect(setOpeningType(doc, id, 'puerta-corredera-elevadora').openings[0]).toMatchObject({ widthMm: 3200, heightMm: 2200, frameFinish: 'aluminio-antracita' });
    // En un muro de 1,2 m la elevadora no cabe: conserva el ancho actual con el tipo nuevo.
    const short = withDoor(1200);
    expect(setOpeningType(short, short.openings[0]!.id, 'puerta-corredera-elevadora').openings[0]).toMatchObject({ widthMm: 900 });
    // Una corredera de 1,4 m pasada a vaivén toma sus 0,8 m: nunca se queda por encima del máximo del tipo.
    const wide = setOpeningType(doc, id, 'puerta-corredera-central');
    expect(setOpeningType(wide, id, 'puerta-vaiven').openings[0]).toMatchObject({ widthMm: 800, leafFinish: 'lacado-blanco' });
  });

  it('el acabado elegido se conserva al cambiar de tipo y el diseño pasa a ser el del tipo nuevo', () => {
    const doc = withDoor(), id = doc.openings[0]!.id;
    const chosen = setOpeningLook(setOpeningType(doc, id, 'puerta-basic'), id, { leafFinish: 'negro' });
    expect(setOpeningType(chosen, id, 'puerta-granero').openings[0]).toMatchObject({ leafFinish: 'negro', leafDesign: 'ranurada', handle: 'tirador' });
    // La de vidrio templado no admite diseño ni acabado de madera.
    const glass = setOpeningType(chosen, id, 'puerta-cristal').openings[0]!;
    expect(glass.leafDesign).toBeUndefined();
    expect(glass.leafFinish).toBeUndefined();
    expect(() => setOpeningLook(setOpeningType(chosen, id, 'puerta-cristal'), id, { leafDesign: 'lamas' })).toThrow(/no admite/);
    expect(setOpeningLook(chosen, id, { leafFinish: undefined }).openings[0]!.leafFinish).toBeUndefined();
  });

  it('un documento antiguo se valida igual y su aspecto resuelto es el de siempre', () => {
    const doc = upgradeConstructionDocument(withDoor());
    const parsed = parseEditorDocument(structuredClone(doc));
    expect(parsed.openings[0]).toEqual(doc.openings[0]);
    for (const opening of doc.openings) for (const key of ['leafDesign', 'leafFinish', 'handle', 'frameFinish']) expect(key in opening).toBe(false);
    expect(openingLook(doc.openings[0]!)).toEqual({ design: 'lisa', finish: null, handle: 'ninguno', frameFinish: null, detailed: false });
    expect(openingLook({ kind: 'puerta', catalogId: 'puerta-vidriera' }).design).toBe('vidrio');
    expect(openingLook({ kind: 'puerta', catalogId: 'puerta-granero' })).toMatchObject({ design: 'ranurada', handle: 'tirador', finish: null, detailed: true });
    const bad = structuredClone(doc);
    Object.assign(bad.openings[0]!, { leafFinish: 'caoba' });
    expect(() => parseEditorDocument(bad)).toThrow(/Diseño o acabado/);
  });

  it('pintar la hoja o el marco vuelve al color pintado', () => {
    const doc = withDoor(), id = doc.openings[0]!.id;
    const finished = setOpeningLook(setOpeningType(doc, id, 'puerta-basic'), id, { leafFinish: 'nogal' });
    expect(paintElement(finished, id, 'leaf', '#123456').openings[0]).toMatchObject({ colors: { leaf: '#123456' } });
    expect(paintElement(finished, id, 'leaf', '#123456').openings[0]!.leafFinish).toBeUndefined();
    const frame = paintElement(finished, id, 'frame', '#ffffff').openings[0]!;
    expect(frame.leafFinish).toBeUndefined();
    expect(frame.colors).toEqual({ frame: '#ffffff', leaf: '#6e4c34' });
  });
});
