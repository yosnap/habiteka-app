import sharp from 'sharp';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { wallPath } from '@/lib/editor-document/wall-path';
import { toAspectRatio, type RasterResult } from '../canvas/rasterize-canvas-doc';

const MAX_SIDE = 1280;
const PADDING_MM = 800;
const n = (value: number) => Number(value.toFixed(2));
const polygon = (points: Point[]) => points.map((point) => `${n(point.x)},${n(point.y)}`).join(' ');

function rotatedBox(x: number, y: number, width: number, depth: number, rotation: number): Point[] {
  const radians = (rotation * Math.PI) / 180,
    cos = Math.cos(radians),
    sin = Math.sin(radians);
  const corners: Array<[number, number]> = [
    [0, 0],
    [width, 0],
    [width, depth],
    [0, depth],
  ];
  return corners.map(([dx, dy]) => ({ x: x + dx * cos - dy * sin, y: y + dx * sin + dy * cos }));
}

function bounds(doc: EditorDocument) {
  const points: Point[] = [...doc.vertices];
  doc.furniture.forEach((item) =>
    points.push(...rotatedBox(item.x, item.y, item.widthMm, item.depthMm, item.rotation)),
  );
  (doc.stairs ?? []).forEach((item) =>
    points.push(...rotatedBox(item.x, item.y, item.widthMm, item.depthMm, item.rotation)),
  );
  (doc.ramps ?? []).forEach((item) =>
    points.push(...rotatedBox(item.x, item.y, item.widthMm, item.depthMm, item.rotation)),
  );
  (doc.columns ?? []).forEach((item) =>
    points.push(...rotatedBox(item.x, item.y, item.widthMm, item.depthMm, item.rotation)),
  );
  if (!points.length) return { x: 0, y: 0, width: 6000, height: 4500 };
  const xs = points.map((point) => point.x),
    ys = points.map((point) => point.y);
  const minX = Math.min(...xs) - PADDING_MM,
    maxX = Math.max(...xs) + PADDING_MM;
  const minY = Math.min(...ys) - PADDING_MM,
    maxY = Math.max(...ys) + PADDING_MM;
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

function pathData(points: Point[]) {
  return points.map((point, index) => `${index ? 'L' : 'M'} ${n(point.x)} ${n(point.y)}`).join(' ');
}

/** PNG arquitectónico limpio: geometría y tipos visuales, nunca rejilla ni controles de edición. */
function svg(
  doc: EditorDocument,
  view: ReturnType<typeof bounds>,
  size: { width: number; height: number },
) {
  const walls = doc.walls
    .filter((wall) => !wall.hidden)
    .map((wall) => {
      const openings = doc.openings.filter((opening) => opening.wallId === wall.id);
      const path = wallPath(doc, wall),
        width = Math.max(wall.thicknessMm, 80);
      const line = `<path d="${pathData(path.samples())}" fill="none" stroke="#2d3436" stroke-width="${width}" stroke-linecap="square"/>`;
      const gaps = openings
        .map((opening) => {
          const t = path.tangent(opening.position),
            center = path.at(opening.position);
          const start = {
            x: center.x - (t.x * opening.widthMm) / 2,
            y: center.y - (t.y * opening.widthMm) / 2,
          };
          const end = {
            x: center.x + (t.x * opening.widthMm) / 2,
            y: center.y + (t.y * opening.widthMm) / 2,
          };
          const color = opening.kind === 'ventana' ? '#6ab7dd' : '#fff';
          return `<path d="M ${n(start.x)} ${n(start.y)} L ${n(end.x)} ${n(end.y)}" stroke="${color}" stroke-width="${width + 24}" stroke-linecap="butt"/>`;
        })
        .join('');
      return `${line}${gaps}`;
    })
    .join('');
  const furniture = doc.furniture
    .map(
      (item) =>
        `<polygon points="${polygon(rotatedBox(item.x, item.y, item.widthMm, item.depthMm, item.rotation))}" fill="#d7c6af" stroke="#806c50" stroke-width="35"/>`,
    )
    .join('');
  const columns = (doc.columns ?? [])
    .map(
      (item) =>
        `<polygon points="${polygon(rotatedBox(item.x, item.y, item.widthMm, item.depthMm, item.rotation))}" fill="#a5aba8" stroke="#56615e" stroke-width="35"/>`,
    )
    .join('');
  const slopes = (doc.ramps ?? [])
    .map(
      (item) =>
        `<polygon points="${polygon(rotatedBox(item.x, item.y, item.widthMm, item.depthMm, item.rotation))}" fill="#a5aaa5" stroke="#526260" stroke-width="35"/><path d="M ${n(item.x + item.widthMm / 2)} ${n(item.y + item.depthMm * 0.8)} L ${n(item.x + item.widthMm / 2)} ${n(item.y + item.depthMm * 0.2)}" stroke="#0f9189" stroke-width="30"/>`,
    )
    .join('');
  const stairs = (doc.stairs ?? [])
    .map((item) => {
      const steps = Array.from({ length: Math.min(item.stepCount, 24) }, (_, index) => {
        const y = item.y + (item.depthMm * (index + 1)) / Math.min(item.stepCount, 24);
        return `<path d="M ${n(item.x)} ${n(y)} L ${n(item.x + item.widthMm)} ${n(y)}" stroke="#8e6f4a" stroke-width="28"/>`;
      }).join('');
      return `<polygon points="${polygon(rotatedBox(item.x, item.y, item.widthMm, item.depthMm, item.rotation))}" fill="#cda777" stroke="#795f40" stroke-width="35"/>${steps}`;
    })
    .join('');
  // width/height en píxeles de salida: sin ellos librsvg rasteriza a un píxel por
  // milímetro del viewBox y un plano grande supera el límite de píxeles de sharp.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" preserveAspectRatio="none" viewBox="${n(view.x)} ${n(view.y)} ${n(view.width)} ${n(view.height)}"><rect x="${n(view.x)}" y="${n(view.y)}" width="${n(view.width)}" height="${n(view.height)}" fill="#fbfaf7"/><g>${walls}${furniture}${columns}${slopes}${stairs}</g></svg>`;
}

export async function rasterizeEditorDocument(doc: EditorDocument): Promise<RasterResult> {
  const view = bounds(doc);
  const outWidth =
    view.width >= view.height ? MAX_SIDE : Math.round((MAX_SIDE * view.width) / view.height);
  const outHeight =
    view.height > view.width ? MAX_SIDE : Math.round((MAX_SIDE * view.height) / view.width);
  const png = await sharp(Buffer.from(svg(doc, view, { width: outWidth, height: outHeight })))
    .resize(outWidth, outHeight, { fit: 'fill' })
    .png()
    .toBuffer();
  return { base64: png.toString('base64'), aspectRatio: toAspectRatio(view.width, view.height) };
}
