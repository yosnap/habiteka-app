import { describe, it, expect } from 'vitest';
import { migrateDoc } from '@/canvas/migrations';
import type { CanvasDoc, StructObj, WallSegment } from '@/canvas/types';

function makeDoc(objects: StructObj[], extras: Partial<CanvasDoc> = {}): CanvasDoc {
  return {
    schemaVersion: 1,
    baseImage: null,
    strokes: [],
    objects,
    products: [],
    selection: null,
    ...extras,
  };
}

function makeWall(overrides: Partial<StructObj> = {}): StructObj {
  return {
    id: 'w1',
    kind: 'wall',
    x: 100,
    y: 200,
    width: 200,
    height: 12,
    rotation: 0,
    ...overrides,
  };
}

function makeSofa(overrides: Partial<StructObj> = {}): StructObj {
  return {
    id: 's1',
    kind: 'sofa',
    x: 50,
    y: 50,
    width: 200,
    height: 90,
    rotation: 0,
    ...overrides,
  };
}

describe('migrateDoc — idempotencia', () => {
  it('un doc ya en v2 se devuelve sin cambios', () => {
    const doc = makeDoc([], { version: 2, walls: [] });
    expect(migrateDoc(doc)).toBe(doc); // misma referencia
  });

  it('un doc sin version se trata como v1 y se migra', () => {
    const doc = makeDoc([makeWall()]);
    const result = migrateDoc(doc);
    expect(result.version).toBe(2);
  });
});

describe('migrateDoc — conversión de muros', () => {
  it('muro horizontal (rotation=0) produce endpoints correctos', () => {
    // Muro en (100, 200), width=200, height=12, rotation=0
    // p1 = (100, 206)  p2 = (300, 206)  thicknessPx = 12
    const doc = makeDoc([makeWall({ x: 100, y: 200, width: 200, height: 12, rotation: 0 })]);
    const result = migrateDoc(doc);

    expect(result.walls).toHaveLength(1);
    const seg = result.walls![0] as WallSegment;
    expect(seg.id).toBe('w1');
    expect(seg.thicknessPx).toBe(12);
    expect(seg.p1.x).toBeCloseTo(100, 2);
    expect(seg.p1.y).toBeCloseTo(206, 2); // y + height/2
    expect(seg.p2.x).toBeCloseTo(300, 2); // x + width
    expect(seg.p2.y).toBeCloseTo(206, 2);
  });

  it('muro vertical (rotation=90) produce endpoints correctos', () => {
    // Muro en (100, 200), width=150, height=12, rotation=90
    // hh=6, rad=π/2, cos=0, sin=1
    // p1 = (100 - 6, 200 + 0) = (94, 200)
    // p2 = (100 + 0 - 6, 200 + 150 + 0) = (94, 350)
    const doc = makeDoc([makeWall({ x: 100, y: 200, width: 150, height: 12, rotation: 90 })]);
    const result = migrateDoc(doc);

    const seg = result.walls![0] as WallSegment;
    expect(seg.p1.x).toBeCloseTo(94, 1);
    expect(seg.p1.y).toBeCloseTo(200, 1);
    expect(seg.p2.x).toBeCloseTo(94, 1);
    expect(seg.p2.y).toBeCloseTo(350, 1);
  });

  it('múltiples muros generan múltiples WallSegments', () => {
    const doc = makeDoc([
      makeWall({ id: 'wa', x: 0, y: 0, width: 100, height: 12, rotation: 0 }),
      makeWall({ id: 'wb', x: 100, y: 0, width: 100, height: 12, rotation: 90 }),
    ]);
    const result = migrateDoc(doc);
    expect(result.walls).toHaveLength(2);
    expect(result.walls!.map((w) => w.id)).toEqual(['wa', 'wb']);
  });

  it('muros desaparecen de objects[]', () => {
    const doc = makeDoc([makeWall(), makeSofa()]);
    const result = migrateDoc(doc);
    expect(result.objects.some((o) => o.kind === 'wall')).toBe(false);
    expect(result.objects).toHaveLength(1);
  });

  it('los datos opcionales del muro (heightM, color) se propagan al segmento', () => {
    const doc = makeDoc([makeWall({ heightM: 3.0, color: '#ff0000' })]);
    const result = migrateDoc(doc);
    const seg = result.walls![0] as WallSegment;
    expect(seg.heightM).toBe(3.0);
    expect(seg.color).toBe('#ff0000');
  });
});

describe('migrateDoc — objetos de suelo', () => {
  it('objetos no-muro conservan todos sus campos', () => {
    const sofa = makeSofa({
      id: 'sofa-1',
      rotation: 45,
      color: '#aabbcc',
      heightM: 0.85,
    });
    const doc = makeDoc([sofa]);
    const result = migrateDoc(doc);

    const migrated = result.objects.find((o) => o.id === 'sofa-1')!;
    expect(migrated.kind).toBe('sofa');
    expect(migrated.x).toBe(sofa.x);
    expect(migrated.y).toBe(sofa.y);
    expect(migrated.rotation).toBe(45);
    expect(migrated.color).toBe('#aabbcc');
    expect(migrated.heightM).toBe(0.85);
  });

  it('se añade catalogId = builtin:<kind> a objetos que no lo tienen', () => {
    const doc = makeDoc([makeSofa()]);
    const result = migrateDoc(doc);
    expect(result.objects[0]!.catalogId).toBe('builtin:sofa');
  });

  it('catalogId existente no se sobreescribe', () => {
    const sofa = makeSofa({ catalogId: 'custom:my-sofa' });
    const doc = makeDoc([sofa]);
    const result = migrateDoc(doc);
    expect(result.objects[0]!.catalogId).toBe('custom:my-sofa');
  });
});

describe('migrateDoc — parentId para puertas y ventanas', () => {
  it('puerta cercana a un muro recibe parentId del muro', () => {
    // Muro horizontal en y=206. Puerta centrada en (150, 210) → muy cerca del muro.
    const wall = makeWall({ id: 'wall-main', x: 100, y: 200, width: 200, height: 12, rotation: 0 });
    const door: StructObj = {
      id: 'door-1',
      kind: 'door',
      x: 145, y: 204,
      width: 60, height: 12,
      rotation: 0,
    };
    const doc = makeDoc([wall, door]);
    const result = migrateDoc(doc);

    const migratedDoor = result.objects.find((o) => o.id === 'door-1')!;
    expect(migratedDoor.parentId).toBe('wall-main');
  });

  it('puerta sin muro cercano NO recibe parentId', () => {
    // Puerta en posición muy alejada de cualquier muro
    const wall = makeWall({ id: 'w1', x: 0, y: 0, width: 100, height: 12, rotation: 0 });
    const door: StructObj = {
      id: 'door-far',
      kind: 'door',
      x: 1000, y: 1000,
      width: 60, height: 12,
      rotation: 0,
    };
    const doc = makeDoc([wall, door]);
    const result = migrateDoc(doc);

    const migratedDoor = result.objects.find((o) => o.id === 'door-far')!;
    expect(migratedDoor.parentId).toBeUndefined();
  });

  it('parentId existente no se sobreescribe', () => {
    const wall = makeWall({ id: 'w1', x: 100, y: 200, width: 200, height: 12, rotation: 0 });
    const door: StructObj = {
      id: 'd1', kind: 'door',
      x: 145, y: 204, width: 60, height: 12, rotation: 0,
      parentId: 'already-set',
    };
    const doc = makeDoc([wall, door]);
    const result = migrateDoc(doc);
    expect(result.objects.find((o) => o.id === 'd1')!.parentId).toBe('already-set');
  });
});
