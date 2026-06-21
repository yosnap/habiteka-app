/**
 * Mapeo de elementos detectados (F5) a objetos del plano. Lógica PURA y
 * cliente-safe: la usan tanto la UI (al poblar el plano) como el servidor. Vive en
 * `canvas/` (no en `server/agent/phases`) para que el componente cliente no
 * importe módulos de servidor.
 */
import type { DetectedObject } from '@/lib/contracts';
import type { StructObj } from './types';

/**
 * Mapea elementos detectados (bbox normalizada 0–1) a objetos del plano en píxeles
 * de stage, respetando las proporciones de la imagen al tamaño del stage.
 */
export function detectedToObjects(
  detected: DetectedObject[],
  stageWidth: number,
  stageHeight: number,
): StructObj[] {
  return detected.map((d) => ({
    // Id único global: un índice por-llamada colisionaría entre detecciones
    // sucesivas y el store confundiría objetos distintos al seleccionar/mover.
    id: `obj-detectado-${globalThis.crypto.randomUUID()}`,
    kind: d.kind,
    x: Math.round(d.bbox.x * stageWidth),
    y: Math.round(d.bbox.y * stageHeight),
    width: Math.max(8, Math.round(d.bbox.w * stageWidth)),
    height: Math.max(8, Math.round(d.bbox.h * stageHeight)),
    rotation: 0,
  }));
}
