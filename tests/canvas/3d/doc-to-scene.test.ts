import { describe, it, expect } from 'vitest';
import {
  docToScene,
  planCenterPx,
  planPointToXZ,
  rotation2DToY,
  resolvePxPerMeter,
  intensity0to100ToPhysical,
  shouldHideWall,
  limitLights,
} from '@/canvas/3d/doc-to-scene';
import type { SceneLight } from '@/canvas/3d/doc-to-scene';
import { DEFAULT_CEILING_M } from '@/canvas/scale';
import { defaultLight } from '@/canvas/light';
import { EXAMPLE_SALON } from '@/canvas/examples';
import { CANVAS_SCHEMA_VERSION } from '@/canvas/types';
import type { CanvasDoc, StructObj } from '@/canvas/types';

function obj(partial: Partial<StructObj> & Pick<StructObj, 'id' | 'kind'>): StructObj {
  return {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    ...partial,
  };
}

function doc(objects: StructObj[], extra?: Partial<CanvasDoc>): CanvasDoc {
  return {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    baseImage: null,
    strokes: [],
    objects,
    products: [],
    selection: null,
    scale: { pxPerMeter: 100 },
    ...extra,
  };
}

describe('doc-to-scene: escala efectiva', () => {
  it('usa pxPerMeter del doc cuando es válido', () => {
    expect(resolvePxPerMeter(doc([], { scale: { pxPerMeter: 50 } }))).toBe(50);
  });

  it('cae a 100 px/m si no hay escala o es inválida', () => {
    expect(resolvePxPerMeter(doc([], { scale: undefined }))).toBe(100);
    expect(resolvePxPerMeter(doc([], { scale: { pxPerMeter: 0 } }))).toBe(100);
    expect(resolvePxPerMeter(doc([], { scale: { pxPerMeter: -5 } }))).toBe(100);
  });
});

describe('doc-to-scene: centro del plano', () => {
  it('es el centro del bounding box', () => {
    const objs = [
      obj({ id: 'a', kind: 'wall', x: 0, y: 0, width: 100, height: 100 }),
      obj({ id: 'b', kind: 'wall', x: 100, y: 100, width: 100, height: 100 }),
    ];
    // bbox = [0,0]..[200,200] → centro [100,100]
    expect(planCenterPx(objs)).toEqual([100, 100]);
  });

  it('devuelve [0,0] sin objetos', () => {
    expect(planCenterPx([])).toEqual([0, 0]);
  });
});

describe('doc-to-scene: conversión px→m y mapeo de ejes', () => {
  it('un punto del plano mapea a su [x,z] esperado relativo al centro', () => {
    const objs = [
      obj({ id: 'a', kind: 'wall', x: 300, y: 300, width: 100, height: 100 }),
      obj({ id: 'b', kind: 'wall', x: 400, y: 400, width: 100, height: 100 }),
    ];
    // bbox = [300,300]..[500,500] → centro [400,400]
    const center = planCenterPx(objs);
    expect(center).toEqual([400, 400]);
    // centro de 'a' = (350,350); relativo = (-50,-50) px → a 100 px/m = (-0,5,-0,5) m
    const [x, z] = planPointToXZ(objs[0]!, center, 100);
    expect(x).toBeCloseTo(-0.5);
    expect(z).toBeCloseTo(-0.5);
  });

  it('Y-2D se mapea a Z-3D: variar solo Y cambia solo Z', () => {
    const center: [number, number] = [0, 0];
    const a = planPointToXZ(obj({ id: 'a', kind: 'wall', x: 0, y: 0, width: 100, height: 100 }), center, 100);
    const b = planPointToXZ(obj({ id: 'b', kind: 'wall', x: 0, y: 200, width: 100, height: 100 }), center, 100);
    // mismo X (sube solo Y en 2D)
    expect(a[0]).toBe(b[0]);
    // distinto Z (la Y del 2D fue a Z del 3D)
    expect(b[1] - a[1]).toBeCloseTo(2); // 200 px / 100 = 2 m
  });

  it('respeta la escala al convertir longitudes', () => {
    const center: [number, number] = [0, 0];
    const p = planPointToXZ(obj({ id: 'a', kind: 'wall', x: 250, y: 0, width: 0, height: 0 }), center, 50);
    expect(p[0]).toBeCloseTo(250 / 50); // 5 m a 50 px/m
  });
});

describe('doc-to-scene: rotación', () => {
  it('90° en 2D (Y-abajo) → -π/2 en Y (Y-arriba) por inversión de eje', () => {
    expect(rotation2DToY(90)).toBeCloseTo(-Math.PI / 2);
  });

  it('0° → 0', () => {
    expect(rotation2DToY(0)).toBeCloseTo(0);
  });

  it('180° → -π', () => {
    expect(rotation2DToY(180)).toBeCloseTo(-Math.PI);
  });
});

describe('doc-to-scene: altura de muros', () => {
  it('muro sin heightM toma la altura de techo del doc', () => {
    const scene = docToScene(doc([obj({ id: 'w', kind: 'wall' })], { ceilingHeightM: 3 }));
    expect(scene.walls[0]!.size[1]).toBe(3); // alto = Y
    expect(scene.walls[0]!.center[1]).toBe(1.5); // apoyado: y = alto/2
  });

  it('muro con heightM propio lo respeta', () => {
    const scene = docToScene(doc([obj({ id: 'w', kind: 'wall', heightM: 2.2 })]));
    expect(scene.walls[0]!.size[1]).toBeCloseTo(2.2);
  });

  it('sin ceilingHeightM usa el default de scale.ts', () => {
    const scene = docToScene(doc([obj({ id: 'w', kind: 'wall' })]));
    expect(scene.walls[0]!.size[1]).toBe(DEFAULT_CEILING_M);
  });
});

describe('doc-to-scene: solo estructura forma el caparazón', () => {
  it('cuenta wall/window/door como muros, ignora muebles', () => {
    const scene = docToScene(
      doc([
        obj({ id: 'w', kind: 'wall' }),
        obj({ id: 'win', kind: 'window' }),
        obj({ id: 'd', kind: 'door' }),
        obj({ id: 'sofa', kind: 'sofa' }),
      ]),
    );
    expect(scene.walls.map((w) => w.id).sort()).toEqual(['d', 'w', 'win']);
  });
});

describe('doc-to-scene: muebles', () => {
  it('incluye objetos no estructurales y no luz como muebles', () => {
    const scene = docToScene(
      doc([
        obj({ id: 'w', kind: 'wall' }),
        obj({ id: 'sofa', kind: 'sofa' }),
        obj({ id: 'mesa', kind: 'mesa' }),
      ]),
    );
    expect(scene.furniture.map((f) => f.id).sort()).toEqual(['mesa', 'sofa']);
  });

  it('excluye luces: kind foco y objetos con atributos light', () => {
    const scene = docToScene(
      doc([
        obj({ id: 'foco', kind: 'foco' }),
        obj({ id: 'lampLuz', kind: 'lampara', light: { color: '#fff', intensidad: 50 } }),
        obj({ id: 'lampMueble', kind: 'lampara' }),
      ]),
    );
    // foco (kind luz) y lampLuz (tiene light) fuera; lampMueble (sin light) dentro.
    expect(scene.furniture.map((f) => f.id)).toEqual(['lampMueble']);
  });

  it('apoya el mueble en el suelo (center.y = alto/2) y usa medidas reales', () => {
    // mesa 120×70 px a 100 px/m = 1,2×0,7 m; altura típica de mesa = 0,75 m.
    const scene = docToScene(doc([obj({ id: 'mesa', kind: 'mesa', width: 120, height: 70 })]));
    const f = scene.furniture[0]!;
    expect(f.size[0]).toBeCloseTo(1.2); // ancho X
    expect(f.size[2]).toBeCloseTo(0.7); // fondo Z
    expect(f.size[1]).toBeGreaterThan(0); // alto Y
    expect(f.center[1]).toBeCloseTo(f.size[1] / 2); // apoyado en el suelo
  });

  it('respeta la rotación del objeto en rotationY', () => {
    const scene = docToScene(doc([obj({ id: 'mesa', kind: 'mesa', rotation: 90 })]));
    expect(scene.furniture[0]!.rotationY).toBeCloseTo(-Math.PI / 2);
  });

  it('refleja el volteo horizontal (flipX) del objeto', () => {
    const flip = docToScene(doc([obj({ id: 'a', kind: 'silla', flipX: true })]));
    const normal = docToScene(doc([obj({ id: 'b', kind: 'silla' })]));
    expect(flip.furniture[0]!.flipX).toBe(true);
    expect(normal.furniture[0]!.flipX).toBe(false);
  });
});

describe('doc-to-scene: intensidad física', () => {
  it('mapea 0→0, 100→máximo, 50→mitad', () => {
    const max = intensity0to100ToPhysical(100);
    expect(intensity0to100ToPhysical(0)).toBe(0);
    expect(max).toBeGreaterThan(0);
    expect(intensity0to100ToPhysical(50)).toBeCloseTo(max / 2);
  });

  it('clampa fuera de rango (reusa clampIntensity de light.ts)', () => {
    expect(intensity0to100ToPhysical(-20)).toBe(0);
    expect(intensity0to100ToPhysical(200)).toBe(intensity0to100ToPhysical(100));
  });
});

describe('doc-to-scene: luces', () => {
  it('un foco con light → una luz puntual con su color e intensidad', () => {
    const scene = docToScene(
      doc([obj({ id: 'f', kind: 'foco', light: { color: '#ff0000', intensidad: 100 } })]),
    );
    expect(scene.lights).toHaveLength(1);
    expect(scene.lights[0]!.color).toBe('#ff0000');
    expect(scene.lights[0]!.intensity).toBeCloseTo(intensity0to100ToPhysical(100));
  });

  it('un foco sin atributos light usa la luz por defecto', () => {
    const scene = docToScene(doc([obj({ id: 'f', kind: 'foco' })]));
    expect(scene.lights[0]!.color).toBe(defaultLight().color);
  });

  it('cuelga la luz a ~80% de la altura de techo', () => {
    const scene = docToScene(doc([obj({ id: 'f', kind: 'foco' })], { ceilingHeightM: 3 }));
    expect(scene.lights[0]!.position[1]).toBeCloseTo(3 * 0.8);
  });

  it('un objeto NO luz con atributos light también cuenta como luz (no mueble)', () => {
    const scene = docToScene(
      doc([obj({ id: 'lamp', kind: 'lampara', light: { color: '#fff', intensidad: 40 } })]),
    );
    expect(scene.lights).toHaveLength(1);
    expect(scene.furniture).toHaveLength(0);
  });

  it('muros y muebles no generan luces', () => {
    const scene = docToScene(doc([obj({ id: 'w', kind: 'wall' }), obj({ id: 's', kind: 'sofa' })]));
    expect(scene.lights).toHaveLength(0);
  });
});

describe('doc-to-scene: límite de luces', () => {
  const mkLight = (id: string, intensity: number): SceneLight => ({
    id,
    position: [0, 2, 0],
    color: '#fff',
    intensity,
    distance: 12,
    decay: 2,
  });

  it('no toca la lista si está dentro del límite', () => {
    const ls = [mkLight('a', 5), mkLight('b', 3)];
    expect(limitLights(ls, 8)).toHaveLength(2);
  });

  it('conserva las MÁS intensas cuando excede el límite', () => {
    const ls = [mkLight('debil', 1), mkLight('fuerte', 10), mkLight('media', 5)];
    const out = limitLights(ls, 2);
    expect(out.map((l) => l.id).sort()).toEqual(['fuerte', 'media']);
  });

  it('preserva el orden de aparición entre las conservadas', () => {
    const ls = [mkLight('x', 9), mkLight('y', 1), mkLight('z', 8)];
    // Conserva x y z (las más fuertes); deben salir en orden x, z.
    expect(limitLights(ls, 2).map((l) => l.id)).toEqual(['x', 'z']);
  });

  it('docToScene aplica el límite por defecto (≤ 8 luces)', () => {
    const objs = Array.from({ length: 12 }, (_, i) =>
      obj({ id: `f${i}`, kind: 'foco', x: i * 10, y: 0, light: { color: '#fff', intensidad: 50 } }),
    );
    expect(docToScene(doc(objs)).lights.length).toBeLessThanOrEqual(8);
  });
});

describe('doc-to-scene: recorte de muros por cámara', () => {
  it('oculta el muro del MISMO lado que la cámara (entre cámara e interior)', () => {
    // Cámara en +Z; el muro frontal (+Z) tapa el interior → se oculta.
    expect(shouldHideWall([0, 1.7], [0, 8])).toBe(true);
  });

  it('mantiene el muro del lado OPUESTO a la cámara (el del fondo)', () => {
    // Cámara en +Z; el muro del fondo (−Z) no tapa → visible.
    expect(shouldHideWall([0, -1.7], [0, 8])).toBe(false);
  });

  it('un muro perpendicular (lateral) no se oculta con umbral por defecto', () => {
    // Cámara en +Z, muro lateral en +X: coseno ≈ 0 < 0,35 → visible.
    expect(shouldHideWall([2.6, 0], [0, 8])).toBe(false);
  });

  it('al girar la cámara cambia qué muro se oculta', () => {
    // Cámara ahora en +X: el muro lateral +X pasa a ocultarse, el +Z deja de ocultarse.
    expect(shouldHideWall([2.6, 0], [8, 0])).toBe(true);
    expect(shouldHideWall([0, 1.7], [8, 0])).toBe(false);
  });

  it('no oculta nada si el muro o la cámara están en el centro', () => {
    expect(shouldHideWall([0, 0], [0, 8])).toBe(false);
    expect(shouldHideWall([0, 1.7], [0, 0])).toBe(false);
  });
});

describe('doc-to-scene: fixture EXAMPLE_SALON', () => {
  const scene = docToScene(EXAMPLE_SALON);

  it('no tiene luces (la lámpara del salón es mueble, sin atributos light)', () => {
    expect(scene.lights).toHaveLength(0);
  });

  it('detecta los 6 elementos estructurales (4 muros + puerta + ventana)', () => {
    expect(scene.walls).toHaveLength(6);
  });

  it('detecta los muebles del salón (tv, mesa, sofá, lámpara)', () => {
    expect(scene.furniture.map((f) => f.kind).sort()).toEqual(['lampara', 'mesa', 'sofa', 'tv']);
  });

  it('el suelo es el bbox de los MUROS: 5,2 × 3,6 m (la ventana que sobresale NO lo estira)', () => {
    expect(scene.floor.size[0]).toBeCloseTo(5.2, 2);
    expect(scene.floor.size[1]).toBeCloseTo(3.6, 2);
  });

  it('usa la escala del doc (100 px/m)', () => {
    expect(scene.pxPerMeter).toBe(100);
  });
});

describe('doc-to-scene: el suelo ignora ventanas/puertas que sobresalen del contorno', () => {
  it('una ventana fuera del muro NO agranda el suelo', () => {
    const scene = docToScene(
      doc([
        obj({ id: 'w-top', kind: 'wall', x: 0, y: 0, width: 400, height: 15 }),
        obj({ id: 'w-bottom', kind: 'wall', x: 0, y: 300, width: 400, height: 15 }),
        obj({ id: 'w-left', kind: 'wall', x: 0, y: 0, width: 15, height: 315 }),
        obj({ id: 'w-right', kind: 'wall', x: 385, y: 0, width: 15, height: 315 }),
        // Ventana que sobresale 30 px por arriba del muro superior.
        obj({ id: 'win', kind: 'window', x: 150, y: -30, width: 100, height: 18 }),
      ]),
    );
    // Suelo = bbox de muros = 400×315 px = 4,0×3,15 m; la ventana (y:-30) NO lo estira.
    expect(scene.floor.size[0]).toBeCloseTo(4.0, 2);
    expect(scene.floor.size[1]).toBeCloseTo(3.15, 2);
  });
});

describe('doc-to-scene: el suelo respeta la rotación de los muros (Draw Walls)', () => {
  it('un muro rotado NO infla ni descentra el suelo (bbox sobre esquinas rotadas)', () => {
    // Muro de 500×15 px rotado 90° sobre su esquina: ocupa ~15 px en X y ~500 en Y, NO 500×15.
    // Con bbox sin rotar el suelo saldría 500 px de ancho; con bbox rotado, ~15.
    const scene = docToScene(
      doc([
        obj({ id: 'w-left', kind: 'wall', x: 100, y: 100, width: 500, height: 15, rotation: 90 }),
        obj({ id: 'w-right', kind: 'wall', x: 400, y: 100, width: 500, height: 15, rotation: 90 }),
        obj({ id: 'w-top', kind: 'wall', x: 100, y: 100, width: 300, height: 15, rotation: 0 }),
        obj({ id: 'w-bot', kind: 'wall', x: 100, y: 600, width: 300, height: 15, rotation: 0 }),
      ]),
    );
    // Extensión real en X: de x=100 (muro izq/sup) a x=415 (muro der rota a x=400, +15 de grosor) → ~315 px.
    // Si ignorara la rotación, maxX llegaría a 900 (400+500) → suelo erróneo de ~8 m.
    expect(scene.floor.size[0]).toBeLessThan(4.0);
    expect(scene.floor.size[0]).toBeGreaterThan(2.5);
  });

  it('el centro del suelo se desplaza del origen si hay muebles fuera del rectángulo de muros', () => {
    // Sala 300×300 en la izquierda + un mueble lejos a la derecha: el centro global (de TODOS
    // los objetos) se va a la derecha, pero el suelo debe seguir centrado en los muros.
    const scene = docToScene(
      doc([
        obj({ id: 'w-top', kind: 'wall', x: 0, y: 0, width: 300, height: 15 }),
        obj({ id: 'w-bot', kind: 'wall', x: 0, y: 300, width: 300, height: 15 }),
        obj({ id: 'w-left', kind: 'wall', x: 0, y: 0, width: 15, height: 315 }),
        obj({ id: 'w-right', kind: 'wall', x: 285, y: 0, width: 15, height: 315 }),
        obj({ id: 'lejos', kind: 'silla', x: 1000, y: 150, width: 45, height: 45 }),
      ]),
    );
    // El suelo abarca ~3×3 m; su centro NO es [0,0] porque el origen de la escena se
    // desplazó hacia el mueble lejano. El offset debe ser apreciable (varios metros).
    expect(Math.abs(scene.floor.center[0])).toBeGreaterThan(1);
  });
});
