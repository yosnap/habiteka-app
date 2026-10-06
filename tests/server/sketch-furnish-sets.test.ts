/**
 * Amueblar reproduce los conjuntos dibujados en el boceto: la barra de la cocina americana con sus taburetes a lo largo,
 * la lámpara de mesa sobre cada mesilla y la alfombra bajo el sofá con su medida dibujada. Guía sintética y respuesta de
 * la IA vacía (lo dibujado se añade solo): sin llamadas reales a la IA.
 */
import { describe, expect, it } from 'vitest';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { applyNativeDesignProposal, type NativeDesignFurniture } from '@/lib/editor-document/native-design-proposal';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { objectCenter } from '@/lib/editor-document/spatial-properties';
import { proposalSize } from '@/lib/editor-document/proposal-coordinates';
import { parseNativeDesignProposalDetailed } from '@/server/agent/editor-v2/native-design-proposal';
import { guideItem, type SketchGuide } from '@/server/agent/editor-v2/sketch-furniture-guide';
import { alignToSketch } from '@/server/agent/editor-v2/sketch-design-rule';
import { matchSketchItem } from '@/server/agent/editor-v2/sketch-catalog-match';

const FRAME = { width: 10000, height: 10000 };
const room = (width: number, height: number) =>
  addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }], true);
/** Objeto dibujado por su centro y su medida en milímetros, como lo deja la lectura detallada. */
const drawn = (label: string, centre: { x: number; y: number }, size: { x: number; y: number }, back: 'arriba' | null = null) =>
  guideItem(label, undefined, { minX: (centre.x - size.x / 2) / FRAME.width, minY: (centre.y - size.y / 2) / FRAME.height,
    maxX: (centre.x + size.x / 2) / FRAME.width, maxY: (centre.y + size.y / 2) / FRAME.height }, back, 1, FRAME);
const guide = (items: SketchGuide['items']): SketchGuide => ({ image: { type: 'text', text: '' }, frameMm: FRAME, items });
const options = { ...defaultRenderDesignOptions(), freedom: 'free' as const, designScope: 'all' as const };
const answer = (furniture: unknown[] = []) => ({ summary: '', materials: {}, roomFinishes: [], kitchens: [], fixedFinishes: [], furniture });
const propose = (doc: ReturnType<typeof room>, items: SketchGuide['items'], furniture: unknown[] = []) =>
  parseNativeDesignProposalDetailed(answer(furniture), 'moderno', doc, options, guide(items)).proposal;
const centre = (item: NativeDesignFurniture) => {
  const size = proposalSize(item, getFurnitureCatalogEntry(item.catalogId)!);
  return objectCenter({ x: item.xMm, y: item.yMm, rotation: item.rotation, ...size });
};
const isStool = (item: NativeDesignFurniture) => item.catalogId.includes('taburete');

describe('lectura de la cocina americana, las lámparas y las alfombras', () => {
  it('reconoce la barra, la península, la isla y la mesa alta como barra exenta, y sus taburetes', () => {
    for (const label of ['barra americana', 'Península', 'isla de cocina', 'barra de desayuno'])
      expect(matchSketchItem(label)).toEqual({ catalogId: 'habiteka:furniture:isla-cocina', role: 'bar' });
    expect(matchSketchItem('mesa alta')).toEqual({ catalogId: 'habiteka:asset:mesa_alta_redonda', role: 'bar' });
    for (const label of ['taburetes', 'sillas altas', 'silla de barra']) expect(matchSketchItem(label)).toEqual({ catalogId: 'habiteka:furniture:taburete' });
    // La isla con placa sigue siendo una pieza exenta, no un tramo de encimera.
    expect(matchSketchItem('isla con placa')?.role).toBe('bar');
    expect(matchSketchItem('encimera con fregadero')).toEqual({ role: 'kitchen' });
    // «Lámpara de mesa» casaba con la mesa de comedor y «lámpara de mesilla» con la mesilla.
    for (const label of ['lámpara de mesilla', 'lámpara de mesa']) expect(matchSketchItem(label)).toEqual({ catalogId: 'habiteka:furniture:lampara-mesa' });
    expect(matchSketchItem('mesilla')).toEqual({ catalogId: 'habiteka:furniture:mesita' });
    expect(drawn('barra americana', { x: 3000, y: 2000 }, { x: 1800, y: 600 }).kind).toBe('bar');
  });

  it('pide lo que va en conjunto aunque la IA lo olvide y lleva la medida dibujada de la alfombra', () => {
    const roomOfRaw = (value: unknown) => (value as { room?: string }).room ?? 'salon';
    const pieces = [
      { label: 'alfombra', roomId: 'salon', roomName: 'Salón', catalogId: 'habiteka:furniture:alfombra', cxMm: 2500, cyMm: 1800, sizeMm: { x: 2400, y: 1700 } },
      { label: 'taburetes', roomId: 'salon', roomName: 'Salón', catalogId: 'habiteka:furniture:taburete', cxMm: 3000, cyMm: 2700 },
    ];
    // La IA ya pidió una alfombra grande girada: conserva su modelo, con el sitio y la medida dibujados y sin giro.
    const ai = [{ catalogId: 'habiteka:furniture:alfombra:grande', wall: '', cxMm: 1, cyMm: 1, rotation: 90, reason: 'IA' }];
    const aligned = alignToSketch(ai, pieces, roomOfRaw) as Record<string, unknown>[];
    expect(aligned[0]).toMatchObject({ catalogId: 'habiteka:furniture:alfombra:grande', cxMm: 2500, cyMm: 1800, rotation: 0, widthMm: 2400, depthMm: 1700 });
    expect(aligned[1]).toMatchObject({ catalogId: 'habiteka:furniture:taburete', cxMm: 3000, cyMm: 2700, reason: 'Dibujado en el boceto' });
  });
});

describe('conjuntos dibujados en el boceto', () => {
  it('coloca la isla con el frente hacia los taburetes y los taburetes a lo largo de ella', () => {
    const doc = room(6000, 4000);
    const proposal = propose(doc, [
      drawn('isla de cocina', { x: 3000, y: 2000 }, { x: 1800, y: 900 }),
      drawn('taburetes', { x: 3000, y: 2700 }, { x: 1500, y: 450 }),
    ]);
    const island = proposal.furniture.find((item) => item.catalogId === 'habiteka:furniture:isla-cocina')!;
    expect(island.rotation).toBe(0);
    expect(centre(island)).toEqual({ x: 3000, y: 2000 });
    const stools = proposal.furniture.filter(isStool);
    expect(stools).toHaveLength(3);
    // De cara a la isla (trasera hacia fuera), tocando su canto inferior (y = 2450) y repartidos a lo largo.
    for (const stool of stools) {
      expect(stool.rotation).toBe(180);
      expect(centre(stool).y - 210 - 2450).toBeGreaterThanOrEqual(-1);
      expect(centre(stool).y - 210 - 2450).toBeLessThanOrEqual(60);
    }
    expect(stools.map((stool) => Math.round(centre(stool).x / 100) * 100).sort()).toEqual([2400, 3000, 3600]);
  });

  it('con los taburetes dibujados encima, la barra se gira y ellos quedan arriba', () => {
    const doc = room(6000, 4000);
    const proposal = propose(doc, [
      drawn('barra americana', { x: 3000, y: 2500 }, { x: 1800, y: 900 }),
      drawn('taburetes', { x: 3000, y: 1800 }, { x: 1500, y: 450 }),
    ]);
    expect(proposal.furniture.find((item) => item.catalogId === 'habiteka:furniture:isla-cocina')!.rotation).toBe(180);
    const stools = proposal.furniture.filter(isStool);
    expect(stools.length).toBeGreaterThan(0);
    expect(stools.every((stool) => centre(stool).y < 2050)).toBe(true);
  });

  it('pone una lámpara de mesa encima de cada mesilla de la cama dibujada', () => {
    const doc = room(4000, 4000);
    const proposal = propose(doc, [
      drawn('cama doble', { x: 2000, y: 1110 }, { x: 1600, y: 2100 }, 'arriba'),
      drawn('lámpara de mesa', { x: 1000, y: 260 }, { x: 300, y: 300 }),
    ]);
    expect(proposal.furniture.filter((item) => item.catalogId === 'habiteka:furniture:mesita')).toHaveLength(2);
    expect(proposal.furniture.filter((item) => item.catalogId === 'habiteka:furniture:lampara-mesa')).toHaveLength(2);
    const applied = applyNativeDesignProposal(doc, proposal);
    const tables = applied.furniture.filter((item) => item.catalogId === 'habiteka:furniture:mesita').map((item) => item.id);
    const lamps = applied.furniture.filter((item) => item.catalogId === 'habiteka:furniture:lampara-mesa');
    expect(lamps.map((lamp) => lamp.hostId).sort()).toEqual([...tables].sort());
  });

  it('pone la alfombra dibujada bajo el sofá con su medida, y la del catálogo si la dibujada no cabe', () => {
    const doc = room(5000, 4000);
    const sofa = drawn('sofá', { x: 2500, y: 535 }, { x: 2300, y: 950 }, 'arriba');
    const proposal = propose(doc, [sofa, drawn('alfombra', { x: 2500, y: 1800 }, { x: 2400, y: 1700 })]);
    const rug = proposal.furniture.find((item) => item.catalogId === 'habiteka:furniture:alfombra')!;
    expect(rug).toMatchObject({ widthMm: 2400, depthMm: 1700 });
    const sofaPlaced = proposal.furniture.find((item) => item.catalogId === 'habiteka:furniture:sofa-3')!;
    expect(centre(rug).x).toBeCloseTo(centre(sofaPlaced).x, 0);
    const applied = applyNativeDesignProposal(doc, proposal);
    expect(applied.furniture.find((item) => item.catalogId === 'habiteka:furniture:alfombra')).toMatchObject({ widthMm: 2400, depthMm: 1700 });

    const huge = propose(doc, [sofa, drawn('alfombra', { x: 2500, y: 2000 }, { x: 4900, y: 3900 })]);
    const fallback = huge.furniture.find((item) => item.catalogId === 'habiteka:furniture:alfombra')!;
    expect(fallback.widthMm).toBeUndefined();
  });
});

describe('cocina americana sin boceto', () => {
  it('los taburetes que pide la IA van a lo largo de su isla; sin isla se descartan', () => {
    const doc = room(6000, 4000);
    const parse = (furniture: unknown[]) => parseNativeDesignProposalDetailed(answer(furniture), 'moderno', doc, options).proposal;
    const island = { catalogId: 'habiteka:furniture:isla-cocina', wall: '', alongMm: 0, cxMm: 3000, cyMm: 2000, rotation: 0, reason: '' };
    const stool = { catalogId: 'habiteka:asset:taburete_barra_madera', wall: '', alongMm: 0, cxMm: 500, cyMm: 500, rotation: 0, reason: '' };
    const withIsland = parse([island, stool]).furniture.filter(isStool);
    expect(withIsland).toHaveLength(3);
    expect(withIsland.every((item) => item.catalogId === stool.catalogId && item.rotation === 180)).toBe(true);
    expect(parse([stool]).furniture.filter(isStool)).toEqual([]);
  });
});
