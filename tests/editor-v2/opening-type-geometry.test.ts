import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type EditorDocument, type Furniture, type Opening } from '@/lib/editor-document/schema';
import { openingSymbol, type SymbolStroke } from '@/lib/editor-document/opening-symbol';
import { openingMeshes } from '@/canvas/editor-v2/scene/opening-meshes';
import { doorSweepSolids } from '@/canvas/editor-v2/door-sweep-solids';
import { assertSpatialPlacement, collisions } from '@/canvas/editor-v2/spatial-placement';
import { spatialOpenings } from '@/server/agent/editor-v2/spatial-opening-geometry';
import { doorSymbols, rasterizeEditorDocument } from '@/server/agent/editor-v2/rasterize-editor-document';
import { rasterizeEditorElevation } from '@/server/agent/editor-v2/rasterize-editor-elevation';
import { setWallCurve } from '@/lib/editor-document/curve-commands';
import { OPENING_TYPES } from '@/lib/editor-document/opening-types';

const opening = (catalogId: string, extra: Partial<Opening> = {}): Opening => ({
  id: 'door', wallId: 'wall', kind: catalogId.startsWith('ventana') ? 'ventana' : 'puerta', position: .5,
  widthMm: catalogId === 'puerta-doble' ? 1400 : 900, dimensionalOrigin: 'physical', catalogId,
  hinge: 'left', swing: 'left', openAngleDeg: catalogId.startsWith('ventana') ? 0 : 90, ...extra,
});

/** Muro de 3 m y 120 mm sobre el eje x; la cara de apertura «left» queda hacia y positivas. */
function wallWith(item: Opening, furniture: Furniture[] = []): EditorDocument {
  return { ...emptyEditorDocument(), schemaVersion: 3,
    vertices: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 3000, y: 0 }],
    walls: [{ id: 'wall', startVertexId: 'a', endVertexId: 'b', thicknessMm: 120, heightMm: 2700,
      materials: { left: 'plaster-white', right: 'plaster-white' }, dimensionalOrigin: 'physical' }],
    openings: [{ heightMm: item.kind === 'ventana' ? 1200 : 2100, elevationMm: item.kind === 'ventana' ? 900 : 0, ...item }],
    furniture, stairs: [] };
}

/** Estancia cerrada de 3 × 3 m con la abertura en el muro sur, para que el alzado dibuje su fachada. */
function roomWith(item: Opening): EditorDocument {
  const doc = wallWith(item), wall = doc.walls[0]!;
  doc.vertices.push({ id: 'c', x: 3000, y: 3000 }, { id: 'd', x: 0, y: 3000 });
  doc.walls.push(...([['b', 'c'], ['c', 'd'], ['d', 'a']] as const).map(([startVertexId, endVertexId], index) =>
    ({ ...wall, id: `w${index}`, startVertexId, endVertexId })));
  return doc;
}

const nightstand = (x: number, y: number): Furniture => ({ id: 'obstacle', kind: 'asset-mesilla', catalogId: 'habiteka:asset:mesilla',
  x, y, rotation: 0, widthMm: 100, depthMm: 100, heightMm: 500, dimensionalOrigin: 'physical' });
const count = (strokes: SymbolStroke[], role: SymbolStroke['role']) => strokes.filter((stroke) => stroke.role === role).length;
const ys = (stroke: SymbolStroke) => stroke.points.filter((_, index) => index % 2 === 1);
const hits = (doc: EditorDocument) => [...collisions(doc).keys()].includes(JSON.stringify(['door', 'obstacle']));

describe('símbolo 2D de cada tipo', () => {
  it('dibuja dos arcos en la de dos hojas y la hoja maciza de la blindada con su grosor', () => {
    const double = openingSymbol(opening('puerta-doble'), 120);
    expect(count(double, 'arc')).toBe(2);
    expect(count(double, 'leaf')).toBe(2);
    const entrance = openingSymbol(opening('puerta-entrada', { widthMm: 950 }), 120);
    expect(count(entrance, 'arc')).toBe(1);
    expect(entrance.find((stroke) => stroke.role === 'leaf')).toMatchObject({ closed: true, fill: 'leaf' });
    expect(openingSymbol(opening('puerta-vidriera'), 120).find((stroke) => stroke.role === 'leaf')).toMatchObject({ fill: 'glass' });
  });

  it('la corredera no tiene arco: hoja paralela por fuera del muro, guía y flecha; cambia de cara con el giro', () => {
    const sliding = openingSymbol(opening('puerta-corredera'), 120);
    expect(count(sliding, 'arc')).toBe(0);
    expect(count(sliding, 'guide')).toBe(1);
    expect(count(sliding, 'arrow')).toBe(1);
    expect(ys(sliding.find((stroke) => stroke.role === 'leaf')!).every((y) => y > 60)).toBe(true);
    const flipped = openingSymbol(opening('puerta-corredera', { swing: 'right' }), 120);
    expect(ys(flipped.find((stroke) => stroke.role === 'leaf')!).every((y) => y < -60)).toBe(true);
  });

  it('la empotrada dibuja su cajón dentro del muro y la plegable un zigzag', () => {
    const pocket = openingSymbol(opening('puerta-corredera-empotrada', { widthMm: 800 }), 120);
    expect(count(pocket, 'arc')).toBe(0);
    expect(count(pocket, 'pocket')).toBe(1);
    expect(ys(pocket.find((stroke) => stroke.role === 'pocket')!).every((y) => Math.abs(y) < 60)).toBe(true);
    const folding = openingSymbol(opening('puerta-plegable', { widthMm: 800 }), 120);
    expect(count(folding, 'arc')).toBe(0);
    const zigzag = ys(folding[0]!);
    expect(zigzag).toHaveLength(5);
    zigzag.forEach((y, index) => index % 2 ? expect(y).toBeGreaterThan(50) : expect(y).toBeCloseTo(0));
  });

  it('cada ventana se distingue por sus líneas', () => {
    expect(count(openingSymbol(opening('ventana-fija'), 120), 'glass')).toBe(2);
    const sliding = openingSymbol(opening('ventana-corredera', { widthMm: 1200 }), 120).filter((stroke) => stroke.role === 'glass');
    expect(sliding).toHaveLength(2);
    expect(Math.sign(ys(sliding[0]!)[0]!)).toBe(-Math.sign(ys(sliding[1]!)[0]!));
    expect(Math.abs(sliding[0]!.points[2]! - sliding[0]!.points[0]!)).toBeLessThan(1200);
    const casement = openingSymbol(opening('ventana-abatible', { widthMm: 600 }), 120);
    expect(casement.filter((stroke) => stroke.role === 'arc').map((stroke) => stroke.dashed)).toEqual([true]);
    expect(count(openingSymbol(opening('ventana-abatible-doble', { widthMm: 1200 }), 120), 'arc')).toBe(2);
    const balcony = openingSymbol(opening('ventana-balconera', { widthMm: 1200 }), 120);
    expect(balcony.filter((stroke) => stroke.role === 'arc').map((stroke) => stroke.dashed)).toEqual([false, false]);
    expect(count(balcony, 'leaf')).toBe(2);
  });
});

describe('modelo 3D de cada tipo', () => {
  it('la puerta de dos hojas lleva dos hojas de media luz y la vidriera, vidrio en su bastidor', () => {
    const double = openingMeshes(wallWith(opening('puerta-doble', { openAngleDeg: 0 })), opening('puerta-doble', { openAngleDeg: 0 }));
    const leaves = double.filter((box) => box.role === 'leaf');
    expect(leaves).toHaveLength(2);
    expect(leaves[0]!.size[0]).toBeCloseTo((1400 - 90) / 2 / 1000);
    const glazed = openingMeshes(wallWith(opening('puerta-vidriera')), opening('puerta-vidriera'));
    expect(glazed.filter((box) => box.role === 'glass')).toHaveLength(1);
    expect(glazed.filter((box) => box.role === 'leaf')).toHaveLength(4);
    const entrance = openingMeshes(wallWith(opening('puerta-entrada', { widthMm: 950 })), opening('puerta-entrada', { widthMm: 950 }));
    expect(entrance.find((box) => box.role === 'leaf')!.size[2]).toBeCloseTo(.07);
  });

  it('la corredera vista cuelga por fuera del muro con su guía y se recoge hacia el lado elegido', () => {
    const closed = opening('puerta-corredera', { openAngleDeg: 0 }), open = opening('puerta-corredera');
    const shut = openingMeshes(wallWith(closed), closed).find((box) => box.role === 'leaf')!;
    expect(shut.position[0]).toBeCloseTo(1.5);
    expect(shut.position[2]).toBeGreaterThan(.06);
    const parked = openingMeshes(wallWith(open), open);
    expect(parked.find((box) => box.role === 'leaf')!.position[0]).toBeCloseTo(1.5 - .81);
    expect(parked.filter((box) => box.role === 'frame').some((box) => box.size[0] > 1.6)).toBe(true);
    const right = opening('puerta-corredera', { hinge: 'right' });
    expect(openingMeshes(wallWith(right), right).find((box) => box.role === 'leaf')!.position[0]).toBeCloseTo(1.5 + .81);
  });

  it('la empotrada abierta entra en el muro; la de vidrio cruza dos hojas acristaladas sobre su carril', () => {
    const pocket = opening('puerta-corredera-empotrada', { widthMm: 800 });
    const leaf = openingMeshes(wallWith(pocket), pocket).find((box) => box.role === 'leaf')!;
    expect(leaf.position[2]).toBeCloseTo(0);
    expect(leaf.position[0]).toBeCloseTo(1.5 - (.71 - .06));
    const patio = opening('puerta-corredera-vidrio', { widthMm: 1800 });
    const boxes = openingMeshes(wallWith(patio), patio), glass = boxes.filter((box) => box.role === 'glass');
    expect(glass).toHaveLength(2);
    expect(Math.sign(glass[0]!.position[2] - 0)).toBe(-Math.sign(glass[1]!.position[2] - 0));
    expect(boxes.some((box) => box.role === 'leaf')).toBe(false);
  });

  it('la plegable son paneles en zigzag y las ventanas cambian montantes y vidrios', () => {
    const folding = opening('puerta-plegable', { widthMm: 800 });
    const panels = openingMeshes(wallWith(folding), folding).filter((box) => box.role === 'leaf');
    expect(panels).toHaveLength(4);
    expect(Math.sign(panels[0]!.rotation)).toBe(-Math.sign(panels[1]!.rotation));
    const glassOf = (id: string, widthMm = 1200) => openingMeshes(wallWith(opening(id, { widthMm })), opening(id, { widthMm })).filter((box) => box.role === 'glass');
    expect(glassOf('ventana-fija', 1000)).toHaveLength(1);
    expect(glassOf('ventana-abatible-doble')).toHaveLength(2);
    expect(new Set(glassOf('ventana-corredera').map((box) => Math.sign(box.position[2]))).size).toBe(2);
    const balcony = opening('ventana-balconera', { widthMm: 1200, heightMm: 2100, elevationMm: 0 });
    const lowest = Math.min(...openingMeshes(wallWith(balcony), balcony).map((box) => box.position[1] - box.size[1] / 2));
    expect(lowest).toBeCloseTo(0);
  });

  it('en un muro curvo las hojas siguen siendo rígidas y la ventana corredera lleva dos vidrios desplazados', () => {
    const curved = (item: Opening) => setWallCurve(wallWith(item), 'wall', 300);
    const double = opening('puerta-doble');
    expect(openingMeshes(curved(double), double).filter((box) => box.role === 'leaf')).toHaveLength(2);
    const sliding = opening('ventana-corredera', { widthMm: 1200 });
    const doc = curved(sliding), glass = openingMeshes(doc, doc.openings[0]!).filter((box) => box.role === 'glass');
    expect(glass.length).toBeGreaterThan(2);
  });
});

describe('barrido y espacio libre de cada puerta', () => {
  it('la abatible conserva su abanico; la de dos hojas tiene dos y las correderas ninguno', () => {
    const fans = (item: Opening) => doorSweepSolids(wallWith(item)).filter((solid) => solid.polygon.length === 3).length;
    expect(fans(opening('puerta-basic'))).toBe(18);
    expect(fans(opening('puerta-doble'))).toBe(36);
    for (const id of ['puerta-corredera', 'puerta-corredera-empotrada', 'puerta-corredera-vidrio', 'puerta-plegable'])
      expect(fans(opening(id))).toBe(0);
  });

  it('un mueble delante del hueco choca con la abatible pero no con las correderas', () => {
    expect(hits(wallWith(opening('puerta-basic'), [nightstand(1450, 350)]))).toBe(true);
    for (const id of ['puerta-corredera', 'puerta-corredera-empotrada', 'puerta-corredera-vidrio', 'puerta-plegable'])
      expect(hits(wallWith(opening(id), [nightstand(1450, 350)]))).toBe(false);
  });

  it('la plegable reserva la franja de sus paneles y la corredera vista el tramo de pared donde se recoge', () => {
    expect(hits(wallWith(opening('puerta-plegable'), [nightstand(1450, 100)]))).toBe(true);
    expect(hits(wallWith(opening('puerta-corredera'), [nightstand(500, 70)]))).toBe(true);
    expect(hits(wallWith(opening('puerta-corredera', { hinge: 'right' }), [nightstand(500, 70)]))).toBe(false);
    expect(hits(wallWith(opening('puerta-corredera', { swing: 'right' }), [nightstand(500, 70)]))).toBe(false);
    const previous = wallWith(opening('puerta-corredera'), [nightstand(500, 800)]);
    expect(() => assertSpatialPlacement(previous, wallWith(opening('puerta-corredera'), [nightstand(500, 70)])))
      .toThrow(/El recorrido de la puerta choca/);
  });

  it('el contexto para la IA nombra el tipo, separa la segunda hoja y la franja de la corredera', () => {
    const [basic] = spatialOpenings(wallWith(opening('puerta-basic')), 'L1');
    expect(basic).not.toHaveProperty('type');
    expect(basic!.swingClearance).toBeDefined();
    const [double] = spatialOpenings(wallWith(opening('puerta-doble')), 'L1');
    expect(double).toMatchObject({ type: 'Puerta de dos hojas', swingClearance: expect.any(Object), secondSwingClearance: expect.any(Object) });
    const [sliding] = spatialOpenings(wallWith(opening('puerta-corredera')), 'L1');
    expect(sliding).toMatchObject({ type: 'Puerta corredera vista', slideClearance: { polygon: expect.any(Array) } });
    expect(sliding!.swingClearance).toBeUndefined();
  });
});

describe('rasterizado del plano y del alzado para la IA', () => {
  it('dibuja dos arcos en la doble, ninguno en la corredera y su guía', () => {
    const arcs = (svg: string) => svg.match(/fill="none" stroke="#b9a58a" stroke-width="18"\/>/g)?.length ?? 0;
    expect(arcs(doorSymbols(wallWith(opening('puerta-basic'))))).toBe(1);
    expect(arcs(doorSymbols(wallWith(opening('puerta-doble'))))).toBe(2);
    const sliding = doorSymbols(wallWith(opening('puerta-corredera')));
    expect(arcs(sliding)).toBe(0);
    expect(sliding).toContain('stroke-dasharray');
  });

  it('genera plano y alzado con todos los tipos sin errores', async () => {
    for (const type of OPENING_TYPES) {
      // La estancia de prueba mide 3 m: la corredera elevadora de 3,2 m entra con un ancho que quepa entre esquinas.
      const doc = roomWith(opening(type.id, { widthMm: Math.min(type.widthMm, 2400), heightMm: type.heightMm, elevationMm: type.elevationMm }));
      await expect(rasterizeEditorDocument(doc, undefined, { doorLeaves: true })).resolves.toMatchObject({ base64: expect.any(String) });
      const sides = await Promise.all((['front', 'back', 'left', 'right'] as const).map((side) => rasterizeEditorElevation(doc, side)));
      expect(sides.filter(Boolean).length).toBeGreaterThan(0);
    }
  });
});
