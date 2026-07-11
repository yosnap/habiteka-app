/**
 * Conversión del plano estructurado (`Plano2dPayload`, en mm) a objetos
 * EDITABLES del editor 2D. Lógica pura y cliente-safe: la usa el diálogo de
 * boceto para aterrizar el plano generado en el canvas.
 *
 * Los muros se crean con `segmentToWall` (mismo camino que el dibujo a mano),
 * así nacen con handles p1/p2 editables. Las aberturas se anclan a su muro con
 * la misma geometría que el snap del stage (esquina desplazada media anchura a
 * lo largo del eje y medio grosor por la normal).
 */
import type { PlanPoint, Plano2dPayload } from '@/lib/contracts';
import { segmentToWall } from './draw-wall';
import type { CanvasScale, StructObj } from './types';

export interface PlanoToDocOptions {
  /** Escala del documento destino. */
  pxPerMeter?: number;
  /** Esquina superior izquierda donde aterriza el plano, en px de stage. */
  originPx?: { x: number; y: number };
}

export interface PlanoDocResult {
  /** Muros y aberturas listos para `insertObjects`. */
  objects: StructObj[];
  /** Escala usada; aplícala al doc si aún no tiene una. */
  scale: CanvasScale;
}

const DEFAULT_PX_PER_METER = 100;
const DEFAULT_ORIGIN_PX = { x: 80, y: 80 };

/** Proyecta el plano métrico a objetos del canvas en píxeles de stage. */
export function planoToDoc(plano: Plano2dPayload, options: PlanoToDocOptions = {}): PlanoDocResult {
  const pxPerMeter = options.pxPerMeter ?? DEFAULT_PX_PER_METER;
  const origin = options.originPx ?? DEFAULT_ORIGIN_PX;
  const scale: CanvasScale = { pxPerMeter, ratio: 100 };

  const walls = plano.zones.flatMap((z) => z.walls);
  const apertures = plano.zones.flatMap((z) => z.apertures);

  // El plano puede empezar en cualquier coordenada mm: se traslada al origen pedido.
  const min = walls.reduce(
    (acc, w) => ({
      x: Math.min(acc.x, w.from.x, w.to.x),
      y: Math.min(acc.y, w.from.y, w.to.y),
    }),
    { x: Infinity, y: Infinity },
  );
  const toPx = (p: PlanPoint) => ({
    x: origin.x + ((p.x - min.x) / 1000) * pxPerMeter,
    y: origin.y + ((p.y - min.y) / 1000) * pxPerMeter,
  });

  const objects: StructObj[] = [];
  // Geometría del eje de cada muro creado, para anclar sus aberturas después.
  const axisByWallId = new Map<string, { obj: StructObj; p1: PlanPoint; p2: PlanPoint }>();

  for (const wall of walls) {
    const p1 = toPx(wall.from);
    const p2 = toPx(wall.to);
    const obj = segmentToWall(
      `wall-${globalThis.crypto.randomUUID()}`,
      p1,
      p2,
      scale,
      wall.thicknessMm / 1000,
    );
    if (!obj) continue; // Degenerado tras la conversión: se omite sin romper el resto.
    objects.push(obj);
    axisByWallId.set(wall.id, { obj, p1, p2 });
  }

  for (const ap of apertures) {
    const anchor = axisByWallId.get(ap.wallId);
    if (!anchor) continue;
    const { obj: wallObj, p1, p2 } = anchor;

    const θ = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const cosθ = Math.cos(θ);
    const sinθ = Math.sin(θ);
    // Centro de la abertura sobre el eje del muro.
    const cx = p1.x + (p2.x - p1.x) * ap.position;
    const cy = p1.y + (p2.y - p1.y) * ap.position;
    const w = (ap.widthMm / 1000) * pxPerMeter;
    const H = wallObj.height; // grosor del muro en px

    objects.push({
      // Un hueco de paso se materializa como puerta (el kind más cercano del
      // catálogo); el usuario puede cambiarla o quitarla.
      id: `${ap.kind === 'ventana' ? 'window' : 'door'}-${globalThis.crypto.randomUUID()}`,
      kind: ap.kind === 'ventana' ? 'window' : 'door',
      // Esquina del objeto: misma geometría que snapToWall (centro − ½ancho por
      // el eje + ½grosor por la normal).
      x: cx - (w / 2) * cosθ + (H / 2) * sinθ,
      y: cy - (w / 2) * sinθ - (H / 2) * cosθ,
      width: w,
      height: H,
      rotation: (θ * 180) / Math.PI,
      parentId: wallObj.id,
    });
  }

  return { objects, scale };
}
