import { describe, it, expect } from 'vitest';
import { autofurnish, interiorRect } from '@/canvas/wizard/autofurnish';
import { buildRoomDoc } from '@/canvas/wizard/build-room-doc';
import {
  ROOM_FURNITURE,
  defaultSelection,
  type FurnitureSelection,
} from '@/canvas/wizard/room-furniture-options';
import type { CanvasDoc, StructObj } from '@/canvas/types';
import { CANVAS_SCHEMA_VERSION } from '@/canvas/types';

const room = (w: number, l: number) => buildRoomDoc({ widthM: w, lengthM: l, ceilingHeightM: 2.5 });

/** ¿Se solapan dos rects axis-aligned? (los muebles del wizard van sin rotar). */
function overlaps(a: StructObj, b: StructObj): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Cualquier par de objetos que se solape (con una pequeña tolerancia de borde). */
function anyOverlap(objects: StructObj[]): [StructObj, StructObj] | null {
  const eps = 0.5;
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i]!;
      const b = { ...objects[j]!, x: objects[j]!.x + eps, y: objects[j]!.y + eps, width: objects[j]!.width - 2 * eps, height: objects[j]!.height - 2 * eps };
      if (overlaps(a, b)) return [objects[i]!, objects[j]!];
    }
  }
  return null;
}

describe('autofurnish: recinto interior', () => {
  it('deriva un interior ≈ medidas pedidas de una sala del wizard', () => {
    const inner = interiorRect(room(5, 4))!;
    expect(inner.width).toBeGreaterThan(480);
    expect(inner.width).toBeLessThan(520);
    expect(inner.height).toBeGreaterThan(380);
    expect(inner.height).toBeLessThan(420);
  });

  it('devuelve null si no hay muros', () => {
    const empty: CanvasDoc = {
      schemaVersion: CANVAS_SCHEMA_VERSION,
      baseImage: null,
      strokes: [],
      objects: [],
      products: [],
      selection: null,
    };
    expect(interiorRect(empty)).toBeNull();
  });

  it('devuelve null si hay un muro rotado (sala no rectangular)', () => {
    const doc = room(4, 3);
    doc.objects.push({ id: 'diag', kind: 'wall', x: 200, y: 200, width: 200, height: 15, rotation: 45 } as StructObj);
    expect(interiorRect(doc)).toBeNull();
  });
});

describe('autofurnish: colocación sin solapes', () => {
  it('cocina (defaults) NO solapa, ni en la esquina nevera-O ↔ encimera-N', () => {
    const { objects } = autofurnish(room(4, 4), 'cocina');
    expect(objects.some((o) => o.kind === 'nevera')).toBe(true);
    expect(objects.some((o) => o.kind === 'encimera')).toBe(true);
    expect(anyOverlap(objects)).toBeNull();
  });

  it('cocina con isla: la isla central no choca con la encimera (fondo respetado)', () => {
    const sel: FurnitureSelection = { ...defaultSelection('cocina'), isla: 1 };
    const { objects } = autofurnish(room(5, 5), 'cocina', sel);
    expect(objects.some((o) => o.kind === 'isla')).toBe(true);
    expect(anyOverlap(objects)).toBeNull();
  });

  it('salón con 4 sillas: coloca 4 y no solapa', () => {
    const sel: FurnitureSelection = { ...defaultSelection('salon'), silla: 4 };
    const { objects } = autofurnish(room(6, 5), 'salon', sel);
    expect(objects.filter((o) => o.kind === 'silla')).toHaveLength(4);
    expect(anyOverlap(objects)).toBeNull();
  });

  it('dormitorio: cama + 2 mesillas + armario sin solapes', () => {
    const { objects } = autofurnish(room(5, 4), 'dormitorio');
    expect(objects.filter((o) => o.kind === 'mesilla')).toHaveLength(2);
    expect(objects.some((o) => o.kind === 'cama')).toBe(true);
    expect(anyOverlap(objects)).toBeNull();
  });

  it('baño (defaults) sin solapes', () => {
    const { objects } = autofurnish(room(3, 3), 'bano');
    expect(anyOverlap(objects)).toBeNull();
  });

  it('los muebles caen dentro del recinto interior', () => {
    const doc = room(5, 4);
    const inner = interiorRect(doc)!;
    for (const o of autofurnish(doc, 'salon').objects) {
      expect(o.x).toBeGreaterThanOrEqual(inner.x - 0.5);
      expect(o.y).toBeGreaterThanOrEqual(inner.y - 0.5);
      expect(o.x + o.width).toBeLessThanOrEqual(inner.x + inner.width + 0.5);
      expect(o.y + o.height).toBeLessThanOrEqual(inner.y + inner.height + 0.5);
    }
  });
});

describe('autofurnish: selección y overflow', () => {
  it('coloca solo lo seleccionado', () => {
    const sel: FurnitureSelection = { nevera: 1 }; // solo nevera
    const { objects } = autofurnish(room(4, 4), 'cocina', sel);
    expect(objects.map((o) => o.kind)).toEqual(['nevera']);
  });

  it('sin selección usa los defaults del tipo', () => {
    const { objects } = autofurnish(room(5, 4), 'salon');
    const kinds = objects.map((o) => o.kind);
    // Defaults del salón: sofá, tv, mesa y 2 sillas.
    expect(kinds).toContain('sofa');
    expect(kinds).toContain('tv');
    expect(kinds).toContain('mesa');
    expect(kinds.filter((k) => k === 'silla')).toHaveLength(2);
  });

  it('lo que no cabe va a omitted y los colocados no se solapan', () => {
    // Sala diminuta: no caben todos los muebles de cocina.
    const { objects, omitted } = autofurnish(room(1.6, 1.6), 'cocina');
    expect(omitted.length).toBeGreaterThan(0);
    expect(anyOverlap(objects)).toBeNull();
  });

  it('sala no rectangular no se amuebla (objects vacío)', () => {
    const doc = room(4, 3);
    doc.objects.push({ id: 'diag', kind: 'wall', x: 200, y: 200, width: 200, height: 15, rotation: 30 } as StructObj);
    expect(autofurnish(doc, 'salon').objects).toEqual([]);
  });
});

describe('room-furniture-options: catálogo de opciones', () => {
  it('defaultSelection del salón incluye 2 sillas', () => {
    expect(defaultSelection('salon').silla).toBe(2);
  });

  it('cada opción usa un kind del catálogo y un anchor válido', () => {
    const anchors = new Set(['N', 'S', 'E', 'O', 'center']);
    for (const opts of Object.values(ROOM_FURNITURE)) {
      for (const o of opts) {
        expect(typeof o.kind).toBe('string');
        expect(anchors.has(o.anchor)).toBe(true);
      }
    }
  });
});
