import { describe, it, expect } from 'vitest';
import { docToScene } from '@/canvas/3d/doc-to-scene';
import type { CanvasDoc, StructObj } from '@/canvas/types';
import { CANVAS_SCHEMA_VERSION } from '@/canvas/types';

function wall(x: number, y: number, w: number, h: number): StructObj {
  return { id: `wall-${x}-${y}`, kind: 'wall', x, y, width: w, height: h, rotation: 0 };
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

/**
 * Verifica que los elementos wall-surface (enchufe, TV de pared…) se anclan al muro más
 * cercano en 3D: se proyectan sobre la línea del muro, se elevan a su altura de instalación
 * y rotan alineados con el muro. Y que NO se cuentan como furniture (cajas en el suelo).
 */
describe('docToScene: wall-surface anclado al muro', () => {
  it('un TV de pared cerca del muro superior aparece en wallSurfaceItems, no en furniture', () => {
    // Muro superior horizontal: x∈[100,500], y=100, grosor 15. TV soltado justo debajo (y≈120).
    const muro = wall(100, 100, 400, 15);
    const tv: StructObj = {
      id: 'tv-1', kind: 'tv_mount', x: 280, y: 120, width: 120, height: 70, rotation: 0,
    };
    const scene = docToScene(doc([muro, tv]));

    // No es furniture (no debe ir al suelo).
    expect(scene.furniture.find((f) => f.id === 'tv-1')).toBeUndefined();
    // Sí genera un item de superficie de muro.
    const ws = scene.wallSurfaceItems.find((w) => w.id === 'tv-1');
    expect(ws).toBeDefined();
    expect(ws!.kind).toBe('tv_mount');
    // Tamaño real de la tabla (TV: 1.2 × 0.7 × 0.08).
    expect(ws!.size[0]).toBeCloseTo(1.2, 1);
    expect(ws!.size[1]).toBeCloseTo(0.7, 1);
    // Elevación: 1.1 m de base + 0.35 (alto/2) ≈ 1.45 m de centro.
    expect(ws!.center[1]).toBeCloseTo(1.1 + 0.7 / 2, 2);
    // La posición XZ cae sobre la línea del muro (y=100px → z = (100-centerY)/100).
    // Comprobamos que z está cerca del plano del muro (no flotando en el centro de la sala).
    expect(ws!.center[2]).toBeLessThan(0);
  });

  it('un enchufe sin muro cercano no se renderiza (no flota)', () => {
    const tv: StructObj = {
      id: 'outlet-1', kind: 'outlet', x: 1000, y: 1000, width: 16, height: 16, rotation: 0,
    };
    const scene = docToScene(doc([tv]));
    expect(scene.wallSurfaceItems.find((w) => w.id === 'outlet-1')).toBeUndefined();
  });
});
