import { planObjects } from '@/lib/editor-document/boundary-types';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';

export interface CanvasViewState { x: number; y: number; scale: number }
export interface CanvasSize { width: number; height: number }

export const DEFAULT_VIEW: CanvasViewState = { x: 80, y: 80, scale: .08 };

/** Zoom alrededor de un punto de pantalla (por defecto el centro), acotado a la escala útil. */
export function zoomedView(view: CanvasViewState, factor: number, size: CanvasSize, point: Point = { x: size.width / 2, y: size.height / 2 }): CanvasViewState {
  const scale = Math.min(.5, Math.max(.015, view.scale * factor));
  return { scale, x: point.x - (point.x - view.x) / view.scale * scale, y: point.y - (point.y - view.y) / view.scale * scale };
}

/** Encuadre de todo el plano (muros, objetos, textos y cotas) con margen. */
export function fittedView(doc: EditorDocument, size: CanvasSize): CanvasViewState {
  const points = [...doc.vertices, ...(doc.terrainSurfaces ?? []).flatMap((surface) => [
    { x: surface.x, y: surface.y }, { x: surface.x + surface.widthMm, y: surface.y + surface.depthMm },
  ]), ...[...planObjects(doc), ...(doc.stairs ?? []), ...(doc.ramps ?? []), ...(doc.columns ?? [])].flatMap((f) => {
    const angle = f.rotation * Math.PI / 180;
    return [[0, 0], [f.widthMm, 0], [f.widthMm, f.depthMm], [0, f.depthMm]].map(([x, y]) => ({
      x: f.x + x! * Math.cos(angle) - y! * Math.sin(angle),
      y: f.y + x! * Math.sin(angle) + y! * Math.cos(angle),
    }));
  }), ...doc.labels, ...doc.dimensions.flatMap((d) => [d.from, d.to])];
  if (!points.length) return DEFAULT_VIEW;
  const minX = Math.min(...points.map((p) => p.x)), minY = Math.min(...points.map((p) => p.y));
  const width = Math.max(1000, Math.max(...points.map((p) => p.x)) - minX);
  const height = Math.max(1000, Math.max(...points.map((p) => p.y)) - minY);
  const thickness = Math.max(0, ...doc.walls.map((w) => w.thicknessMm));
  const scale = Math.max(.001, Math.min(.3, Math.max(40, size.width - 160) / (width + thickness), Math.max(40, size.height - 160) / (height + thickness)));
  return { scale, x: (size.width - width * scale) / 2 - minX * scale, y: (size.height - height * scale) / 2 - minY * scale };
}
