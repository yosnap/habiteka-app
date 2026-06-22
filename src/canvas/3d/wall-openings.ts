/**
 * Huecos reales de ventana y puerta en los muros del 3D (lógica PURA, sin React/Three).
 *
 * Hoy una ventana/puerta se renderizaría como un muro macizo: se funde con la pared y "no
 * se ve". Aquí se descompone cada muro en cajas (`WallBox`) que rodean el hueco —izquierda,
 * derecha, dintel y, para ventanas, alféizar— dejando el vano abierto. La ventana añade un
 * `GlassPane` (cristal); la puerta queda como hueco a ras de suelo.
 *
 * Convención de ejes (la fuente de bugs): no hay relación FK ventana↔muro, solo solapamiento
 * geométrico 2D. Y los muros NO comparten convención de orientación:
 *   - Draw Walls fija siempre `width=longitud, height=grosor, rotation=ángulo`.
 *   - Los muros del seed son a mano: un muro vertical es `width=grosor, height=longitud, rotation=0`.
 * Por eso el eje longitudinal del muro se deriva del LADO MAYOR del rectángulo, no de `rotation`.
 *
 * Reúsa `objectCenterPx`/`objectCornersPx`/`planPointToXZ`/`rotation2DToY` de `doc-to-scene`
 * (mismo pivote de Konva: rota sobre la esquina) para no reintroducir el desfase 2D↔3D.
 */
import type { StructObj } from '../types';
import { pxToMeters, effectiveHeightM } from '../scale';
import {
  objectCenterPx,
  objectCornersPx,
  planPointToXZ,
  rotation2DToY,
  type WallBox,
  type GlassPane,
  type OpeningFrame,
} from './doc-to-scene';

/** Altura del alféizar de una ventana (m desde el suelo). No hay dato en el modelo. */
export const SILL_M = 0.9;
/** Holgura del dintel bajo el techo/altura del muro (m). */
export const LINTEL_GAP_M = 0.3;
/** Margen extra (px) al asociar un hueco a un muro por distancia perpendicular. */
const ASSOCIATION_MARGIN_PX = 8;
/** Grosor de los perfiles del marco y del travesaño de una ventana (m). */
const FRAME_PROFILE_M = 0.06;
/** Profundidad de la carpintería respecto al grosor del muro (fracción): algo más fina. */
const FRAME_DEPTH_FRACTION = 0.6;

/** Eje longitudinal de un muro, derivado de su lado mayor (no de `rotation`). */
export interface WallAxis {
  /** Longitud del muro en px (lado mayor del rectángulo). */
  L: number;
  /** Grosor del muro en px (lado menor). */
  t: number;
  /** Vector unitario del eje longitudinal en el plano (X, Y-2D): [ux, uy]. */
  u: [number, number];
}

/**
 * Eje longitudinal del muro. `L = max(w,h)`, `t = min(w,h)`. La dirección del lado `width`
 * en el plano (X, Y-2D) es `(cosθ, sinθ)` —misma base que `objectCenterPx`—; si el lado
 * largo es `height` (muro "vertical" del seed), el eje es el perpendicular `(−sinθ, cosθ)`.
 */
export function wallAxis(wall: Pick<StructObj, 'width' | 'height' | 'rotation'>): WallAxis {
  const rad = ((wall.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const widthIsLong = wall.width >= wall.height;
  const L = widthIsLong ? wall.width : wall.height;
  const t = widthIsLong ? wall.height : wall.width;
  // Eje de `width` = (cos, sin); eje de `height` = perpendicular (−sin, cos).
  const u: [number, number] = widthIsLong ? [cos, sin] : [-sin, cos];
  return { L, t, u };
}

/**
 * Distancia perpendicular (px) del centro de un hueco al eje longitudinal (recta) del muro.
 * Se mide respecto a la recta que pasa por el centro del muro con dirección `u`.
 */
function perpDistancePx(
  opening: Pick<StructObj, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
  wall: Pick<StructObj, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
  axis: WallAxis,
): number {
  const [ox, oy] = objectCenterPx(opening);
  const [wx, wy] = objectCenterPx(wall);
  const dx = ox - wx;
  const dy = oy - wy;
  // Componente perpendicular = |d − (d·u)·u| = |d × u| (en 2D, producto cruzado escalar).
  return Math.abs(dx * axis.u[1] - dy * axis.u[0]);
}

/**
 * Asocia un hueco al muro `wall` más cercano por DISTANCIA PERPENDICULAR de su centro al eje
 * del muro (no por área de solape: los solapes reales del seed son de 6–9px y un umbral de
 * área los descartaría). Devuelve el muro o `null` si ninguno está dentro del tope
 * `(t + dimHuecoPerp)/2 + margen` — inalcanzable con datos válidos.
 */
export function associateOpening(
  opening: StructObj,
  walls: readonly StructObj[],
): StructObj | null {
  let best: StructObj | null = null;
  let bestDist = Infinity;
  for (const wall of walls) {
    const axis = wallAxis(wall);
    const dist = perpDistancePx(opening, wall, axis);
    // Dimensión del hueco perpendicular al muro ≈ su lado menor (el grosor del hueco).
    const openingPerp = Math.min(opening.width, opening.height);
    const tolerance = (axis.t + openingPerp) / 2 + ASSOCIATION_MARGIN_PX;
    if (dist <= tolerance && dist < bestDist) {
      best = wall;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Intervalo `[u0, u1]` (px, a lo largo del eje del muro, medido desde un extremo en `0..L`)
 * que ocupa el hueco. Se proyectan las 4 esquinas del hueco sobre el eje `u` y se toma
 * `[min, max]`; el desplazamiento perpendicular se descarta solo al proyectar. Clampado a `[0,L]`.
 */
export function openingSpanLocal(
  opening: Pick<StructObj, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
  wall: Pick<StructObj, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
  axis: WallAxis,
): [number, number] {
  const [wx, wy] = objectCenterPx(wall);
  let min = Infinity;
  let max = -Infinity;
  for (const [px, py] of objectCornersPx(opening)) {
    // Proyección escalar sobre u, relativa al centro del muro, luego a [0, L] (extremo 0).
    const s = (px - wx) * axis.u[0] + (py - wy) * axis.u[1] + axis.L / 2;
    min = Math.min(min, s);
    max = Math.max(max, s);
  }
  return [Math.max(0, Math.min(axis.L, min)), Math.max(0, Math.min(axis.L, max))];
}

/** Un hueco proyectado al espacio local del muro (en px sobre el eje, + tipo). */
interface LocalOpening {
  id: string;
  kind: 'window' | 'door';
  /** [u0, u1] en px sobre el eje del muro. */
  span: [number, number];
  /** Altura propia del hueco (m), si la trae (puerta con heightM). */
  heightM?: number;
}

/**
 * Descompone un muro en cajas (`WallBox`) alrededor de sus huecos, devolviendo también los
 * cristales (`GlassPane`) de las ventanas. Todo en UN recorrido (DRY).
 *
 * - Segmentos de muro de altura completa en los tramos SIN hueco (incluidos los extremos).
 * - Por cada hueco: dintel encima; alféizar debajo solo en ventanas (puerta llega al suelo).
 * - El cristal de la ventana ocupa el vano `[sill, lintel]`.
 *
 * Geometría local→mundo: una caja en `[u0,u1]×[v0,v1]` con grosor `t` tiene centro local
 * `uc = (u0+u1)/2 − L/2` sobre el eje `u` (relativo al centro del muro) y `(v0+v1)/2` en Y;
 * en mundo se suma `u·(uc·pxPerMeter→m)` al centro del muro en XZ.
 */
export function splitWallWithOpenings(
  wall: StructObj,
  openings: readonly StructObj[],
  ceilingHeightM: number,
  planCenter: readonly [number, number],
  pxPerMeter: number,
): { boxes: WallBox[]; panes: GlassPane[]; frames: OpeningFrame[] } {
  const axis = wallAxis(wall);
  const H = effectiveHeightM(wall, ceilingHeightM);
  const tM = pxToMeters(axis.t, { pxPerMeter });
  const rotationY = rotation2DToY(wall.rotation);
  const [wcx, wcz] = planPointToXZ(wall, planCenter, pxPerMeter);

  // Centro en mundo (XZ) de una caja cuyo centro local sobre el eje es `ucPx` (px).
  const worldCenterXZ = (ucPx: number): [number, number] => {
    const ucM = pxToMeters(ucPx, { pxPerMeter });
    return [wcx + axis.u[0] * ucM, wcz + axis.u[1] * ucM];
  };

  // Pieza de carpintería (marco/travesaño/hoja) ubicada en un sub-rango local del hueco:
  // `[uaPx, ubPx]` a lo largo del eje (relativo al extremo 0) y `[va, vb]` en altura (m),
  // con profundidad `depth` (m). Devuelve un `OpeningFrame` listo para el render.
  const frameAt = (
    uaPx: number,
    ubPx: number,
    va: number,
    vb: number,
    depth: number,
    id: string,
    material: 'frame' | 'door',
  ): OpeningFrame => {
    const [cx, cz] = worldCenterXZ((uaPx + ubPx) / 2);
    return {
      id,
      center: [cx, (va + vb) / 2, cz],
      size: [pxToMeters(ubPx - uaPx, { pxPerMeter }), Math.abs(vb - va), depth],
      rotationY,
      material,
    };
  };

  // Proyecta cada hueco a [u0,u1] local y ordena por u0 (soporta ≥1 hueco por muro).
  const locals: LocalOpening[] = openings
    .map((o) => ({
      id: o.id,
      kind: (o.kind === 'door' ? 'door' : 'window') as 'window' | 'door',
      span: openingSpanLocal(o, wall, axis),
      heightM: o.heightM,
    }))
    .filter((o) => o.span[1] > o.span[0])
    .sort((a, b) => a.span[0] - b.span[0]);

  const boxes: WallBox[] = [];
  const panes: GlassPane[] = [];
  const frames: OpeningFrame[] = [];
  const frameDepth = tM * FRAME_DEPTH_FRACTION;
  const profilePx = FRAME_PROFILE_M * pxPerMeter; // grosor del perfil a lo largo del eje (px)

  // Caja de muro de altura completa entre [u0,u1] px (un tramo macizo). idSuffix único.
  const pushFullSegment = (u0: number, u1: number, idSuffix: string) => {
    if (u1 - u0 <= 1e-6) return;
    const [cx, cz] = worldCenterXZ((u0 + u1) / 2);
    boxes.push({
      id: `${wall.id}:${idSuffix}`,
      center: [cx, H / 2, cz],
      size: [pxToMeters(u1 - u0, { pxPerMeter }), H, tM],
      rotationY,
    });
  };

  // Sin huecos: una sola caja igual que antes (segmento completo 0..L).
  if (locals.length === 0) {
    pushFullSegment(0, axis.L, 'full');
    return { boxes, panes, frames };
  }

  let cursor = 0;
  locals.forEach((op, i) => {
    const [u0, u1] = op.span;
    // Tramo macizo a la izquierda del hueco (si lo hay).
    if (u0 > cursor) pushFullSegment(cursor, u0, `seg${i}`);

    // Span vertical del vano (m): ventana [SILL, H−GAP]; puerta [0, heightM ?? H−GAP].
    const lintelBottom = Math.max(0, H - LINTEL_GAP_M);
    const vTop = op.kind === 'door' ? Math.min(op.heightM ?? lintelBottom, H) : lintelBottom;
    const vBottom = op.kind === 'door' ? 0 : Math.min(SILL_M, vTop);

    const widthM = pxToMeters(u1 - u0, { pxPerMeter });
    const [cx, cz] = worldCenterXZ((u0 + u1) / 2);

    // Dintel: caja sobre el vano (de vTop al techo del muro).
    if (H - vTop > 1e-6) {
      boxes.push({
        id: `${op.id}:lintel`,
        center: [cx, (vTop + H) / 2, cz],
        size: [widthM, H - vTop, tM],
        rotationY,
      });
    }
    // Alféizar: caja bajo el vano (solo ventana, de 0 a vBottom).
    if (op.kind === 'window' && vBottom > 1e-6) {
      boxes.push({
        id: `${op.id}:sill`,
        center: [cx, vBottom / 2, cz],
        size: [widthM, vBottom, tM],
        rotationY,
      });
    }
    if (op.kind === 'window' && vTop - vBottom > 1e-6) {
      // VENTANA = cristal + carpintería (marco perimetral + travesaño en cruz), para que se
      // lea como una ventana y no como un agujero. Marco perimetral: 4 perfiles dentro del vano.
      const fp = Math.min(profilePx, (u1 - u0) / 2); // perfil acotado al ancho del vano
      const fpM = FRAME_PROFILE_M;
      frames.push(frameAt(u0, u1, vBottom, vBottom + fpM, frameDepth, `${op.id}:f-bottom`, 'frame'));
      frames.push(frameAt(u0, u1, vTop - fpM, vTop, frameDepth, `${op.id}:f-top`, 'frame'));
      frames.push(frameAt(u0, u0 + fp, vBottom, vTop, frameDepth, `${op.id}:f-left`, 'frame'));
      frames.push(frameAt(u1 - fp, u1, vBottom, vTop, frameDepth, `${op.id}:f-right`, 'frame'));
      // Travesaño en cruz: un montante vertical y un peinazo horizontal centrados en el vano.
      const uMid = (u0 + u1) / 2;
      const vMid = (vBottom + vTop) / 2;
      frames.push(frameAt(uMid - fp / 2, uMid + fp / 2, vBottom, vTop, frameDepth, `${op.id}:f-mullion`, 'frame'));
      frames.push(frameAt(u0, u1, vMid - fpM / 2, vMid + fpM / 2, frameDepth, `${op.id}:f-transom`, 'frame'));
      // Cristal detrás de la carpintería (un poco más fino que el muro).
      panes.push({
        id: `${op.id}:glass`,
        center: [cx, (vBottom + vTop) / 2, cz],
        size: [widthM, vTop - vBottom, tM * 0.4],
        rotationY,
      });
    } else if (op.kind === 'door' && vTop - vBottom > 1e-6) {
      // PUERTA = hoja de madera que rellena el vano (algo más fina que el muro).
      frames.push({
        id: `${op.id}:leaf`,
        center: [cx, (vBottom + vTop) / 2, cz],
        size: [widthM, vTop - vBottom, frameDepth],
        rotationY,
        material: 'door',
      });
    }

    cursor = Math.max(cursor, u1);
  });

  // Tramo macizo final a la derecha del último hueco.
  if (cursor < axis.L) pushFullSegment(cursor, axis.L, 'segEnd');

  return { boxes, panes, frames };
}
