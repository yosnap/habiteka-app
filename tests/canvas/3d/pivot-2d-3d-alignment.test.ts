/**
 * F7.1 — Diagnóstico del pivote de rotación 2D↔3D (red-team #1, Critical).
 *
 * Konva (2D) rota un objeto sobre su ORIGEN = esquina superior-izquierda
 * (`structure-layer.tsx`: <Group x={o.x} y={o.y} rotation> sin offsetX/offsetY).
 * Por tanto el CENTRO geométrico que el usuario ve es (x,y) + (w/2,h/2) ROTADO por `rotation`.
 *
 * `docToScene.planPointToXZ` (3D) usa el centro del AABB SIN rotar: (x + w/2, y + h/2).
 *
 * Para `rotation = 0` ambos coinciden (de ahí que nunca se haya notado: todos los objetos
 * actuales son rotation=0). Para `rotation ≠ 0` divergen, y un muro dibujado a mano (Draw
 * Walls, fase 2) aparecería desplazado en 3D. Este test FIJA esa divergencia como línea base
 * y servirá de regresión cuando la fase 2 alinee el pivote (entonces el desfase debe ser ~0).
 */
import { describe, it, expect } from 'vitest';
import { planPointToXZ, resolvePxPerMeter } from '@/canvas/3d/doc-to-scene';
import type { CanvasDoc, StructObj } from '@/canvas/types';
import { CANVAS_SCHEMA_VERSION } from '@/canvas/types';

/** Centro REAL en 2D tal como lo pinta Konva: rota (w/2,h/2) sobre la esquina (x,y). */
function konvaCenter2D(o: Pick<StructObj, 'x' | 'y' | 'width' | 'height' | 'rotation'>): {
  x: number;
  y: number;
} {
  const rad = (o.rotation * Math.PI) / 180;
  const hw = o.width / 2;
  const hh = o.height / 2;
  return {
    x: o.x + hw * Math.cos(rad) - hh * Math.sin(rad),
    y: o.y + hw * Math.sin(rad) + hh * Math.cos(rad),
  };
}

/** Centro que ASUME docToScene (AABB sin rotar), expresado en px para comparar con Konva. */
function docSceneCenterPx(o: Pick<StructObj, 'x' | 'y' | 'width' | 'height'>): {
  x: number;
  y: number;
} {
  return { x: o.x + o.width / 2, y: o.y + o.height / 2 };
}

function doc(objects: StructObj[]): CanvasDoc {
  return {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    baseImage: null,
    strokes: [],
    objects,
    products: [],
    selection: null,
    scale: { pxPerMeter: 100 },
  };
}

const wall = (rotation: number): StructObj => ({
  id: 'w',
  kind: 'wall',
  x: 200,
  y: 200,
  width: 300,
  height: 15,
  rotation,
});

describe('pivote 2D↔3D: con rotation=0 NO hay desfase', () => {
  it('el centro de Konva y el de docToScene coinciden a 0°', () => {
    const o = wall(0);
    const k = konvaCenter2D(o);
    const d = docSceneCenterPx(o);
    expect(k.x).toBeCloseTo(d.x);
    expect(k.y).toBeCloseTo(d.y);
  });
});

describe('pivote 2D↔3D: con rotation≠0 HAY desfase (bug latente documentado)', () => {
  // Línea base ANTES de la corrección de la fase 2. Cuando la fase 2 alinee el pivote,
  // este bloque debe actualizarse a "desfase ~0" (la corrección lo cierra).
  it('a 90° el centro real (Konva) y el asumido (docToScene) divergen notablemente', () => {
    const o = wall(90);
    const k = konvaCenter2D(o);
    const d = docSceneCenterPx(o);
    const dist = Math.hypot(k.x - d.x, k.y - d.y);
    // Documenta el desfase actual: NO es cero. (Para un muro 300×15 a 90°, ~200 px ≈ 2 m.)
    expect(dist).toBeGreaterThan(50);
  });

  it('el desfase a 90° equivale a la diferencia entre rotar (w/2,h/2) sobre esquina vs centro', () => {
    const o = wall(90);
    const k = konvaCenter2D(o);
    const d = docSceneCenterPx(o);
    // A 90°: Konva center = (x - h/2, y + w/2) = (200-7.5, 200+150) = (192.5, 350).
    expect(k.x).toBeCloseTo(192.5);
    expect(k.y).toBeCloseTo(350);
    // docToScene asume (350, 207.5) → desfase real en X y Y.
    expect(d.x).toBeCloseTo(350);
    expect(d.y).toBeCloseTo(207.5);
  });
});

describe('pivote 2D↔3D: planPointToXZ ya respeta el pivote de Konva (fix F7.2)', () => {
  it('planPointToXZ de un muro rotado coincide con el centro real que se ve en 2D', () => {
    const o = wall(90);
    const d = doc([o]);
    const pxPerMeter = resolvePxPerMeter(d);
    // Origen de referencia: el centro del AABB (lo que antes asumía docToScene).
    const origin: [number, number] = [o.x + o.width / 2, o.y + o.height / 2];
    const [x, z] = planPointToXZ(o, origin, pxPerMeter);
    // El centro REAL de Konva relativo a ese mismo origen, en metros:
    const k = konvaCenter2D(o);
    const kx = (k.x - origin[0]) / pxPerMeter;
    const kz = (k.y - origin[1]) / pxPerMeter;
    // Tras el fix, planPointToXZ y el centro de Konva coinciden (desfase ~0).
    expect(Math.hypot(kx - x, kz - z)).toBeLessThan(0.01);
  });
});
