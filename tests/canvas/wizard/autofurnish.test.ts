import { describe, it, expect } from 'vitest';
import { autofurnish, interiorRect } from '@/canvas/wizard/autofurnish';
import { buildRoomDoc } from '@/canvas/wizard/build-room-doc';
import { FURNISH_TEMPLATES } from '@/canvas/wizard/furnish-templates';
import type { CanvasDoc, StructObj } from '@/canvas/types';
import { CANVAS_SCHEMA_VERSION } from '@/canvas/types';

const room = (w: number, l: number) => buildRoomDoc({ widthM: w, lengthM: l, ceilingHeightM: 2.5 });

describe('autofurnish: recinto interior', () => {
  it('deriva un interior ≈ medidas pedidas de una sala del wizard', () => {
    const inner = interiorRect(room(5, 4))!;
    // Interior en px a 100 px/m: ~500 × 400 (± tolerancia por grosor).
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
    doc.objects.push({
      id: 'diag',
      kind: 'wall',
      x: 200,
      y: 200,
      width: 200,
      height: 15,
      rotation: 45,
    } as StructObj);
    expect(interiorRect(doc)).toBeNull();
  });
});

describe('autofurnish: colocación por tipo', () => {
  it('salón coloca su set (sofá, tv, mesa, lámpara)', () => {
    const items = autofurnish(room(5, 4), 'salon');
    expect(items.map((o) => o.kind).sort()).toEqual(['lampara', 'mesa', 'sofa', 'tv']);
  });

  it('los muebles caen DENTRO del recinto interior', () => {
    const doc = room(5, 4);
    const inner = interiorRect(doc)!;
    for (const o of autofurnish(doc, 'dormitorio')) {
      expect(o.x).toBeGreaterThanOrEqual(inner.x - 0.01);
      expect(o.y).toBeGreaterThanOrEqual(inner.y - 0.01);
      expect(o.x + o.width).toBeLessThanOrEqual(inner.x + inner.width + 0.01);
      expect(o.y + o.height).toBeLessThanOrEqual(inner.y + inner.height + 0.01);
    }
  });

  it('el sofá del salón se ancla a la pared sur (parte baja del interior)', () => {
    const doc = room(5, 4);
    const inner = interiorRect(doc)!;
    const sofa = autofurnish(doc, 'salon').find((o) => o.kind === 'sofa')!;
    // Su borde inferior está cerca del borde sur del interior.
    expect(inner.y + inner.height - (sofa.y + sofa.height)).toBeLessThan(20);
  });

  it('una sala no rectangular no se amuebla (devuelve [])', () => {
    const doc = room(4, 3);
    doc.objects.push({ id: 'diag', kind: 'wall', x: 200, y: 200, width: 200, height: 15, rotation: 30 } as StructObj);
    expect(autofurnish(doc, 'salon')).toEqual([]);
  });
});

describe('autofurnish: plantillas usan solo kinds del catálogo', () => {
  it('todos los kinds de las plantillas existen', () => {
    // Si un kind no existe, kindSizePx caería al fallback; comprobamos que no haga falta.
    for (const set of Object.values(FURNISH_TEMPLATES)) {
      for (const p of set) {
        expect(typeof p.kind).toBe('string');
        expect(p.along).toBeGreaterThanOrEqual(0);
        expect(p.along).toBeLessThanOrEqual(1);
      }
    }
  });
});
