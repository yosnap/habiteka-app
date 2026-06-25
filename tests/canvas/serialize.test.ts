import { describe, it, expect } from 'vitest';
import { serializeCanvas, deserializeCanvas } from '@/canvas/serialize';
import { type CanvasDoc, CANVAS_SCHEMA_VERSION } from '@/canvas/types';

const sample: CanvasDoc = {
  schemaVersion: CANVAS_SCHEMA_VERSION,
  baseImage: { url: 'https://cdn.test/base.png', width: 800, height: 600 },
  strokes: [{ id: 's1', points: [0, 0, 10, 10], color: '#ff0000', width: 3 }],
  objects: [{ id: 'o1', kind: 'wall', x: 5, y: 5, width: 100, height: 12, rotation: 0 }],
  products: [{ id: 'p1', marketplaceItemId: 'm1', x: 20, y: 30, targetRef: 'salon' }],
  selection: { type: 'object', objectIds: ['o1'] },
};

describe('serialización del canvas', () => {
  it('round-trip CanvasDoc → jsonb → CanvasDoc conserva el contenido', () => {
    const json = JSON.parse(JSON.stringify(serializeCanvas(sample)));
    const back = deserializeCanvas(json);

    expect(back.schemaVersion).toBe(CANVAS_SCHEMA_VERSION);
    expect(back.baseImage).toEqual(sample.baseImage);
    expect(back.strokes).toEqual(sample.strokes);
    expect(back.objects).toEqual(sample.objects);
    expect(back.products).toEqual(sample.products);
  });

  it('no persiste la selección (estado de UI efímero)', () => {
    const json = serializeCanvas(sample) as { selection: unknown };
    expect(json.selection).toBeNull();
  });

  it('persiste y rehidrata el contorno del suelo (formas no rectangulares)', () => {
    const withOutline: CanvasDoc = {
      ...sample,
      floorOutline: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 50, y: 50 },
        { x: 50, y: 100 },
        { x: 0, y: 100 },
      ],
    };
    const back = deserializeCanvas(JSON.parse(JSON.stringify(serializeCanvas(withOutline))));
    expect(back.floorOutline).toEqual(withOutline.floorOutline);
  });

  it('descarta un floorOutline con menos de 3 vértices o vértices inválidos', () => {
    const back = deserializeCanvas({
      ...JSON.parse(JSON.stringify(serializeCanvas(sample))),
      floorOutline: [{ x: 1, y: 2 }, { x: 'mal', y: 3 }],
    });
    expect(back.floorOutline).toBeUndefined();
  });

  it('persiste el color (pintura) de un objeto solo si es hex válido', () => {
    const withColor: CanvasDoc = {
      ...sample,
      objects: [
        { id: 'w1', kind: 'wall', x: 0, y: 0, width: 100, height: 12, rotation: 0, color: '#aabbcc' },
        { id: 'w2', kind: 'wall', x: 0, y: 0, width: 100, height: 12, rotation: 0, color: 'rojo' },
      ],
    };
    const back = deserializeCanvas(JSON.parse(JSON.stringify(serializeCanvas(withColor))));
    expect(back.objects.find((o) => o.id === 'w1')?.color).toBe('#aabbcc');
    // Color inválido se descarta (no rompe el objeto).
    expect(back.objects.find((o) => o.id === 'w2')?.color).toBeUndefined();
  });

  it('deserializa de forma defensiva un payload corrupto sin romper', () => {
    const back = deserializeCanvas({
      strokes: [{ id: 's', points: ['x', 1, 2] }, 'basura'],
      objects: [
        { id: 'o', kind: 'invalido' },
        { id: 'o2', kind: 'door', x: 1 },
      ],
      products: [{ marketplaceItemId: 'sin-id' }],
    });
    // Trazo: filtra puntos no numéricos; objeto inválido descartado; el válido entra.
    expect(back.strokes[0]?.points).toEqual([1, 2]);
    expect(back.objects).toHaveLength(1);
    expect(back.objects[0]?.kind).toBe('door');
    expect(back.products).toHaveLength(0); // producto sin id se descarta
  });

  it('un payload no-objeto devuelve un documento vacío', () => {
    expect(deserializeCanvas(null).objects).toHaveLength(0);
    expect(deserializeCanvas('texto').strokes).toHaveLength(0);
  });

  it('conserva la opacidad del fondo en el round-trip y la acota a [0,1]', () => {
    const conOpacidad = deserializeCanvas({
      baseImage: { url: 'https://cdn.test/r.png', width: 10, height: 10, opacity: 0.4 },
    });
    expect(conOpacidad.baseImage?.opacity).toBe(0.4);

    // Opacidad fuera de rango se acota; un fondo sin opacidad queda opaco (undefined).
    const acotada = deserializeCanvas({
      baseImage: { url: 'https://cdn.test/r.png', width: 10, height: 10, opacity: 5 },
    });
    expect(acotada.baseImage?.opacity).toBe(1);
    const sinOpacidad = deserializeCanvas({
      baseImage: { url: 'https://cdn.test/r.png', width: 10, height: 10 },
    });
    expect(sinOpacidad.baseImage?.opacity).toBeUndefined();

    // opacity 0 (fondo invisible) es un valor válido: no debe caer a 1.
    const invisible = deserializeCanvas({
      baseImage: { url: 'https://cdn.test/r.png', width: 10, height: 10, opacity: 0 },
    });
    expect(invisible.baseImage?.opacity).toBe(0);
  });

  it('descarta un fondo con width/height no positivos (evita NaN en la capa)', () => {
    const back = deserializeCanvas({
      baseImage: { url: 'https://cdn.test/r.png', width: 0, height: 100 },
    });
    expect(back.baseImage).toBeNull();
  });

  it('coordenadas no finitas (NaN/Infinity) caen a 0 (no rompen render/SVG)', () => {
    const back = deserializeCanvas({
      objects: [
        { id: 'o', kind: 'wall', x: NaN, y: Infinity, width: -Infinity, height: 10, rotation: 0 },
      ],
    });
    const o = back.objects[0]!;
    expect(o.x).toBe(0);
    expect(o.y).toBe(0);
    expect(o.width).toBe(0);
    expect(o.height).toBe(10);
  });

  it('round-trip de la escala arquitectónica (válida se conserva)', () => {
    const conEscala: CanvasDoc = { ...sample, scale: { pxPerMeter: 50, ratio: 50 } };
    const back = deserializeCanvas(JSON.parse(JSON.stringify(serializeCanvas(conEscala))));
    expect(back.scale).toEqual({ pxPerMeter: 50, ratio: 50 });
  });

  it('no persiste una escala ausente (doc sin scale ⇒ sin scale)', () => {
    const json = serializeCanvas(sample) as { scale?: unknown };
    expect(json.scale).toBeUndefined();
    expect(deserializeCanvas(json).scale).toBeUndefined();
  });

  it('descarta una escala malformada o con pxPerMeter no positivo', () => {
    expect(deserializeCanvas({ scale: { pxPerMeter: 0 } }).scale).toBeUndefined();
    expect(deserializeCanvas({ scale: { pxPerMeter: -5 } }).scale).toBeUndefined();
    expect(deserializeCanvas({ scale: { pxPerMeter: NaN } }).scale).toBeUndefined();
    expect(deserializeCanvas({ scale: 'basura' }).scale).toBeUndefined();
  });

  it('conserva pxPerMeter válido pero descarta un ratio inválido', () => {
    const back = deserializeCanvas({ scale: { pxPerMeter: 80, ratio: -1 } });
    expect(back.scale).toEqual({ pxPerMeter: 80 });
  });

  it('round-trip de los atributos de luz de un foco', () => {
    const back = deserializeCanvas({
      objects: [
        { id: 'l1', kind: 'foco', x: 1, y: 2, width: 40, height: 40, rotation: 0, light: { color: '#ffcc88', intensidad: 70 } },
      ],
    });
    expect(back.objects[0]?.light).toEqual({ color: '#ffcc88', intensidad: 70 });
  });

  it('acota la intensidad de la luz y descarta una luz sin color', () => {
    const acotada = deserializeCanvas({
      objects: [
        { id: 'l1', kind: 'foco', x: 0, y: 0, width: 40, height: 40, rotation: 0, light: { color: '#fff', intensidad: 500 } },
      ],
    });
    expect(acotada.objects[0]?.light?.intensidad).toBe(100);

    const sinColor = deserializeCanvas({
      objects: [
        { id: 'l1', kind: 'foco', x: 0, y: 0, width: 40, height: 40, rotation: 0, light: { intensidad: 50 } },
      ],
    });
    expect(sinColor.objects[0]?.light).toBeUndefined();
  });
});
