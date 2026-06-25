'use client';

/**
 * Lógica de inglete (miter) entre muros.
 *
 * Dos muros comparten junta cuando cualquiera de sus extremos (p1/p2) está a
 * menos de SNAP_DIST px del extremo de otro muro.  En cada junta se calcula la
 * bisectriz de las normales de ambos muros.  La bisectriz, expresada en el
 * espacio local de cada muro, define el corte diagonal de su polígono (ver
 * wallPolygon en object-shapes.tsx).
 *
 * computeWallMiters: función principal — devuelve un Map de id → WallMiter.
 *   Se usa en structure-layer para pasar el corte a objectShape.
 *
 * WallJunctionCaps: ya no se renderiza (el polígono miter sustituye al overlay).
 *   Se conserva exportado por compatibilidad.
 */
import type { StructObj } from '@/canvas/types';

const SNAP_DIST = 10; // px — tolerancia de detección de junta

// ─── Tipos públicos ───────────────────────────────────────────────────────────

/** Dirección del corte en el espacio LOCAL de la pared (bisectriz proyectada). */
export interface MiterDir {
  lbx: number;
  lby: number;
}

/** Datos de corte para los dos extremos de un muro. */
export interface WallMiter {
  p1?: MiterDir; // corte en el extremo p1 (inicio del segmento)
  p2?: MiterDir; // corte en el extremo p2 (final del segmento)
}

// ─── Geometría interna ────────────────────────────────────────────────────────

interface WallGeom {
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  nx: number; // normal unitaria x (perpendicular al muro, en mundo)
  ny: number; // normal unitaria y
  half: number; // grosor / 2 en px
}

/**
 * Calcula extremos y normal de cualquier muro (dibujado o de plantilla).
 *
 * Muros dibujados (drawn=true): group en p1+normal*half, width=largo, height=grosor.
 * Muros de plantilla (rotation=0 implícito): grupo en la esquina top-left del rect;
 *   la orientación se infiere de la proporción width/height.
 */
function wallGeom(o: StructObj): WallGeom | null {
  if (o.kind !== 'wall') return null;

  if (o.drawn) {
    const angle = (o.rotation * Math.PI) / 180;
    const nx = Math.sin(angle);
    const ny = -Math.cos(angle);
    const half = o.height / 2;
    const p1 = { x: o.x - nx * half, y: o.y - ny * half };
    const p2 = {
      x: p1.x + Math.cos(angle) * o.width,
      y: p1.y + Math.sin(angle) * o.width,
    };
    return { p1, p2, nx, ny, half };
  }

  // Muro de plantilla (rotation ≈ 0): top-left en (o.x, o.y)
  if (o.width >= o.height) {
    const half = o.height / 2;
    return {
      p1: { x: o.x, y: o.y + half },
      p2: { x: o.x + o.width, y: o.y + half },
      nx: 0, ny: -1, half,
    };
  }
  const half = o.width / 2;
  return {
    p1: { x: o.x + half, y: o.y },
    p2: { x: o.x + half, y: o.y + o.height },
    nx: 1, ny: 0, half,
  };
}

/** Convierte la bisectriz de mundo al espacio local de un muro con rotación `rot_rad`. */
function toLocal(bx: number, by: number, rot_rad: number): MiterDir {
  const c = Math.cos(rot_rad), s = Math.sin(rot_rad);
  return { lbx: bx * c + by * s, lby: -bx * s + by * c };
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Calcula el corte de inglete para cada muro.
 * Devuelve un Map<id, WallMiter>; solo contiene entradas para muros con al
 * menos una junta detectada.
 */
export function computeWallMiters(walls: StructObj[]): Map<string, WallMiter> {
  const result = new Map<string, WallMiter>();

  type GeomEntry = { id: string; geom: WallGeom; rotRad: number };
  const geoms: GeomEntry[] = walls
    .map((w) => {
      const geom = wallGeom(w);
      return geom ? { id: w.id, geom, rotRad: (w.rotation * Math.PI) / 180 } : null;
    })
    .filter((x): x is GeomEntry => x !== null);

  for (let i = 0; i < geoms.length; i++) {
    const a = geoms[i]!;
    for (let j = i + 1; j < geoms.length; j++) {
      const b = geoms[j]!;

      for (const aEnd of ['p1', 'p2'] as const) {
        const pa = aEnd === 'p1' ? a.geom.p1 : a.geom.p2;
        for (const bEnd of ['p1', 'p2'] as const) {
          const pb = bEnd === 'p1' ? b.geom.p1 : b.geom.p2;
          if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > SNAP_DIST) continue;

          // Bisectriz mundial de las normales de ambos muros
          const bx = a.geom.nx + b.geom.nx;
          const by = a.geom.ny + b.geom.ny;
          const len = Math.hypot(bx, by);
          if (len < 0.01) continue; // muros antiparalelos: sin inglete

          const ubx = bx / len, uby = by / len;

          // Corte local para el muro A
          const mA = result.get(a.id) ?? {};
          if (aEnd === 'p1') mA.p1 = toLocal(ubx, uby, a.rotRad);
          else               mA.p2 = toLocal(ubx, uby, a.rotRad);
          result.set(a.id, mA);

          // Corte local para el muro B
          const mB = result.get(b.id) ?? {};
          if (bEnd === 'p1') mB.p1 = toLocal(ubx, uby, b.rotRad);
          else               mB.p2 = toLocal(ubx, uby, b.rotRad);
          result.set(b.id, mB);
        }
      }
    }
  }
  return result;
}

/**
 * Componente de overlay (líneas de inglete).
 * Reemplazado por el polígono miter en object-shapes; se mantiene inactivo.
 */
export function WallJunctionCaps(_props: { walls: StructObj[] }) {
  return null;
}
