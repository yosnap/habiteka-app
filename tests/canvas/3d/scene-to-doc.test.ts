import { describe, it, expect } from 'vitest';
import {
  sceneXZToPlanCenterPx,
  planCenterPxToCorner,
  rotationYToDoc,
  translatePatch,
  rotatePatch,
  type SceneCoords,
} from '@/canvas/3d/scene-to-doc';
import {
  objectCenterPx,
  planPointToXZ,
  rotation2DToY,
} from '@/canvas/3d/doc-to-scene';
import type { StructObj } from '@/canvas/types';

const TOLERANCE = 1e-6;

/** Fixture de un StructObj con valores razonables. */
function obj(partial: Partial<StructObj> & Pick<StructObj, 'id' | 'kind'>): StructObj {
  return {
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    rotation: 0,
    ...partial,
  };
}

/** Escena de referencia: 100 px/m, plano centrado en (500, 400). */
const SCENE: SceneCoords = {
  planCenterPx: [500, 400],
  pxPerMeter: 100,
};

// ============================================================
// sceneXZToPlanCenterPx — inverso de planPointToXZ/objectCenterPx
// ============================================================

describe('sceneXZToPlanCenterPx: inverso de planPointToXZ', () => {
  it('recupera el centro px de un objeto desde su posición XZ worldspace', () => {
    const o = obj({ id: 'a', kind: 'wall', x: 100, y: 200, width: 200, height: 100, rotation: 0 });
    const xz = planPointToXZ(o, SCENE.planCenterPx, SCENE.pxPerMeter);
    const [cx, cy] = sceneXZToPlanCenterPx(xz, SCENE.planCenterPx, SCENE.pxPerMeter);
    const [ecx, ecy] = objectCenterPx(o);
    expect(cx).toBeCloseTo(ecx, 6);
    expect(cy).toBeCloseTo(ecy, 6);
  });

  it('funciona con objetos rotados (el centro px se conserva sin importar la rotación)', () => {
    const o = obj({ id: 'b', kind: 'mesa', x: 300, y: 150, width: 150, height: 80, rotation: 45 });
    const xz = planPointToXZ(o, SCENE.planCenterPx, SCENE.pxPerMeter);
    const [cx, cy] = sceneXZToPlanCenterPx(xz, SCENE.planCenterPx, SCENE.pxPerMeter);
    const [ecx, ecy] = objectCenterPx(o);
    expect(cx).toBeCloseTo(ecx, 6);
    expect(cy).toBeCloseTo(ecy, 6);
  });
});

// ============================================================
// planCenterPxToCorner — inverso de objectCenterPx
// ============================================================

describe('planCenterPxToCorner: inverso de objectCenterPx', () => {
  for (const rotation of [0, 45, 90, 180, 270, 359]) {
    it(`recupera la esquina (x,y) de Konva desde el centro, rotation=${rotation}°`, () => {
      const o = obj({
        id: 'c',
        kind: 'wall',
        x: 120,
        y: 250,
        width: 200,
        height: 80,
        rotation,
      });
      const [cx, cy] = objectCenterPx(o);
      const { x, y } = planCenterPxToCorner(cx, cy, o);
      expect(x).toBeCloseTo(o.x, 6);
      expect(y).toBeCloseTo(o.y, 6);
    });
  }
});

// ============================================================
// rotationYToDoc — inverso de rotation2DToY
// ============================================================

describe('rotationYToDoc: inverso de rotation2DToY', () => {
  for (const deg of [0, 45, 90, 180, 270, 359]) {
    it(`round-trip rotation=${deg}°`, () => {
      const rotY = rotation2DToY(deg);
      const result = rotationYToDoc(rotY);
      expect(result).toBeCloseTo(deg, 5);
    });
  }

  it('normaliza a [0, 360): valor negativo → equivalente positivo', () => {
    // rotation2DToY(10) = −10·π/180; rotationYToDoc de eso = 10°
    const rotY = rotation2DToY(350);
    const result = rotationYToDoc(rotY);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(360);
    expect(result).toBeCloseTo(350, 5);
  });

  it('rotationYToDoc(0) → 0', () => {
    expect(rotationYToDoc(0)).toBe(0);
  });
});

// ============================================================
// translatePatch — round-trip posición completo
// ============================================================

describe('translatePatch: round-trip posición', () => {
  const cases = [
    { rotation: 0, x: 100, y: 200, width: 200, height: 100 },
    { rotation: 45, x: 300, y: 150, width: 150, height: 80 },
    { rotation: 90, x: 50, y: 300, width: 200, height: 60 },
    { rotation: 180, x: 400, y: 100, width: 120, height: 120 },
  ];

  for (const c of cases) {
    it(`rotation=${c.rotation}°: traducir la posición XZ actual y volver al mismo (x,y)`, () => {
      const o = obj({ id: 'd', kind: 'mesa', ...c });
      // Forward: objeto → posición worldspace
      const xz = planPointToXZ(o, SCENE.planCenterPx, SCENE.pxPerMeter);
      // Inverso: posición worldspace → patch (x, y)
      const patch = translatePatch(o, xz, SCENE);
      expect(patch.x).toBeCloseTo(o.x, TOLERANCE < 1 ? 6 : 0);
      expect(patch.y).toBeCloseTo(o.y, TOLERANCE < 1 ? 6 : 0);
    });
  }

  it('mover un objeto 1 metro en X aumenta su centro px en pxPerMeter px', () => {
    const o = obj({ id: 'e', kind: 'wall', x: 0, y: 0, width: 100, height: 100, rotation: 0 });
    const xz = planPointToXZ(o, SCENE.planCenterPx, SCENE.pxPerMeter);
    const movedXZ: [number, number] = [xz[0] + 1, xz[1]]; // +1 metro en X
    const patch = translatePatch(o, movedXZ, SCENE);
    // El centro X del objeto debería haberse desplazado en pxPerMeter px
    const [origCx] = objectCenterPx(o);
    const [newCx] = objectCenterPx({ ...o, ...patch });
    expect(newCx - origCx).toBeCloseTo(SCENE.pxPerMeter, 6);
  });
});

// ============================================================
// rotatePatch — el centro del objeto no se desplaza
// ============================================================

describe('rotatePatch: el centro del objeto permanece fijo', () => {
  const cases = [
    { fromRot: 0, toRotY: rotation2DToY(45) },
    { fromRot: 45, toRotY: rotation2DToY(90) },
    { fromRot: 0, toRotY: rotation2DToY(180) },
    { fromRot: 90, toRotY: rotation2DToY(0) },
  ];

  for (const c of cases) {
    it(`rotación ${c.fromRot}° → rotationY=${c.toRotY.toFixed(3)}: centro fijo`, () => {
      const o = obj({
        id: 'f',
        kind: 'wall',
        x: 150,
        y: 200,
        width: 200,
        height: 80,
        rotation: c.fromRot,
      });
      const [cx0, cy0] = objectCenterPx(o);
      const patch = rotatePatch(o, c.toRotY, SCENE);
      const [cx1, cy1] = objectCenterPx({ ...o, ...patch });
      expect(cx1).toBeCloseTo(cx0, 6);
      expect(cy1).toBeCloseTo(cy0, 6);
    });
  }

  it('rotar 360° vuelve exactamente al mismo (x, y, rotation)', () => {
    const o = obj({ id: 'g', kind: 'wall', x: 200, y: 300, width: 160, height: 80, rotation: 30 });
    const patch = rotatePatch(o, rotation2DToY(30 + 360), SCENE);
    expect(patch.x).toBeCloseTo(o.x, 6);
    expect(patch.y).toBeCloseTo(o.y, 6);
    expect(patch.rotation).toBeCloseTo(30, 5);
  });
});
