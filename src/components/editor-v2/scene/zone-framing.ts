import type { ZoneMaskRegions } from '@/lib/editor-document/render-view';

/** Margen alrededor de la zona que conserva enteros los muros que la cierran (m). */
export const ZONE_FRAME_MARGIN_M = 0.3;
/** El corte del lado de la cámara entra un poco en la zona para no dejar una lámina de muro. */
const NEAR_CUT_INSET_M = 0.01;

/** Plano de corte de Three: se conserva lo que cumple normal·p + constant ≥ 0. */
export interface ClipPlane { normal: [number, number, number]; constant: number }
export interface ZoneFraming {
  /** Caja que encuadra la cámara, en metros de mundo. */
  focus: { center: [number, number, number]; size: [number, number, number] };
  planes: ClipPlane[];
}

/** Lado de la zona que mira a la cámara en cada alzado: ahí se corta hasta el borde. */
const NEAR_SIDE: Partial<Record<string, 'minX' | 'maxX' | 'minZ' | 'maxZ'>> = {
  front: 'maxZ', back: 'minZ', left: 'minX', right: 'maxX',
};

/**
 * Con zonas permitidas, cada vista pedida enseña SOLO la zona: la cámara la
 * encuadra y todo lo que queda fuera se corta, como una maqueta seccionada. En
 * los alzados el corte del lado de la cámara pasa por el borde de la zona, así
 * que ningún muro, exterior o interior, tapa lo que se va a diseñar.
 * Plano en mm (x, y) → mundo en metros (x, z); `elevationM` es la base del nivel.
 */
export function zoneFraming(regions: ZoneMaskRegions, view: string, heightM: number, elevationM = 0): ZoneFraming | null {
  const points = regions.flat();
  if (!points.length) return null;
  const minX = Math.min(...points.map((p) => p.x)) / 1000, maxX = Math.max(...points.map((p) => p.x)) / 1000;
  const minZ = Math.min(...points.map((p) => p.y)) / 1000, maxZ = Math.max(...points.map((p) => p.y)) / 1000;
  const near = NEAR_SIDE[view];
  const edge = (side: 'minX' | 'maxX' | 'minZ' | 'maxZ', value: number, outward: 1 | -1) =>
    side === near ? value - outward * NEAR_CUT_INSET_M : value + outward * ZONE_FRAME_MARGIN_M;
  const planes: ClipPlane[] = [
    { normal: [1, 0, 0], constant: -edge('minX', minX, -1) },
    { normal: [-1, 0, 0], constant: edge('maxX', maxX, 1) },
    { normal: [0, 0, 1], constant: -edge('minZ', minZ, -1) },
    { normal: [0, 0, -1], constant: edge('maxZ', maxZ, 1) },
  ];
  return {
    focus: {
      center: [(minX + maxX) / 2, elevationM + heightM / 2, (minZ + maxZ) / 2],
      size: [maxX - minX + 2 * ZONE_FRAME_MARGIN_M, heightM, maxZ - minZ + 2 * ZONE_FRAME_MARGIN_M],
    },
    planes,
  };
}
