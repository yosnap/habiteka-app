import sharp from 'sharp';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { wallPath } from '@/lib/editor-document/wall-path';
import { toAspectRatio, type RasterResult } from '../canvas/rasterize-canvas-doc';
import { spatialOpenings } from './spatial-opening-geometry';
import { localToWorld } from '@/lib/editor-document/spatial-properties';
import { furnitureProfile, isBed, isSofa } from './furniture-views';
import { planDrawOrder } from '@/lib/editor-document/plan-draw-order';

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

/**
 * Almohadas en el lado del cabecero y respaldo del sofá, como en un plano de interiorismo: una caja lisa no dice hacia
 * dónde mira el mueble y el generador lo giraba. Las fracciones son las de la geometría 3D del catálogo (lado trasero en y = 0).
 */
function orientationMarks(item: EditorDocument['furniture'][number]): string {
  const part = (x1: number, y1: number, x2: number, y2: number, fill: string) => `<polygon points="${polygon(
    [[x1, y1], [x2, y1], [x2, y2], [x1, y2]].map(([x, y]) => localToWorld(item, { x: x! * item.widthMm, y: y! * item.depthMm })))}" fill="${fill}" stroke="#806c50" stroke-width="20"/>`;
  if (isBed(item)) return [part(0, 0, 1, .07, '#8a6a45'), part(.04, .36, .96, .97, '#ece4d6'),
    ...(item.widthMm < 1200 ? [part(.16, .12, .84, .3, '#f8f5ee')] : [part(.09, .12, .47, .3, '#f8f5ee'), part(.53, .12, .91, .3, '#f8f5ee')])].join('');
  if (isSofa(item)) return [part(0, 0, 1, .2, '#a39686'), part(0, .2, .1, 1, '#a39686'), part(.9, .2, 1, 1, '#a39686')].join('');
  return '';
}

/** Mueble de cocina como en un plano: encimera continua y, encima, el hueco de cada aparato con su color. */
const SLOT_FILL: Record<string, string> = { fregadero: '#9fb6c2', vitroceramica: '#2d3436', 'frigorifico-columna': '#eef1f1' };
function kitchenRuns(doc: EditorDocument): string {
  return (doc.kitchenRuns ?? []).map((run) => {
    const box = (x1: number, y1: number, x2: number, y2: number) => polygon([[x1, y1], [x2, y1], [x2, y2], [x1, y2]].map(([x, y]) => localToWorld(run, { x: x!, y: y! })));
    const slots = run.kitchen.slots.map((slot) => `<polygon points="${box(slot.positionMm - slot.widthMm / 2 + 30, 60, slot.positionMm + slot.widthMm / 2 - 30, run.depthMm - 60)}" fill="${SLOT_FILL[slot.kind] ?? '#b9bfc0'}" stroke="#5f6b68" stroke-width="20"/>`).join('');
    return `<polygon points="${box(0, 0, run.widthMm, run.depthMm)}" fill="#dadedb" stroke="#5f6b68" stroke-width="35"/>${slots}`;
  }).join('');
}

function bounds(doc: EditorDocument, zone?: readonly Point[]) {
  if (zone?.length) {
    const xs = zone.map((point) => point.x), ys = zone.map((point) => point.y);
    const x = Math.min(...xs) - PADDING_MM, y = Math.min(...ys) - PADDING_MM;
    return { x, y, width: Math.max(...xs) - x + PADDING_MM,
      height: Math.max(...ys) - y + PADDING_MM };
  }
  const points: Point[] = [...doc.vertices];
  [...doc.furniture, ...(doc.kitchenRuns ?? [])].forEach((item) =>
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
  zone?: readonly Point[],
  doorLeaves = false,
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
  // Hoja y arco de giro de cada puerta, con la geometría del 3D: el generador conserva así su lado y su giro. Un
  // sector relleno se dibujaba como una cuña de madera; el arco fino es el símbolo habitual de un plano.
  const leaves = doorLeaves ? spatialOpenings(doc, 'P').flatMap((opening) => opening.swingClearance
    ? [`<path d="${pathData(opening.swingClearance.polygon.slice(1))}" fill="none" stroke="#b9a58a" stroke-width="18"/><path d="M ${n(opening.swingClearance.hinge.x)} ${n(opening.swingClearance.hinge.y)} L ${n(opening.swingClearance.openEnd.x)} ${n(opening.swingClearance.openEnd.y)}" stroke="#8a6a45" stroke-width="50" stroke-linecap="round"/>`]
    : []).join('') : '';
  // Las alfombras van debajo, más claras, y lo apoyado sobre otro mueble encima: si no, una alfombra tapaba la cama.
  const isRug = (item: EditorDocument['furniture'][number]) => furnitureProfile(item) === 'rug';
  const furniture = planDrawOrder(doc.furniture)
    .map(
      (item) => isRug(item)
        ? `<polygon points="${polygon(rotatedBox(item.x, item.y, item.widthMm, item.depthMm, item.rotation))}" fill="#ebe3d5" stroke="#c4b49b" stroke-width="20"/>`
        : `<polygon points="${polygon(rotatedBox(item.x, item.y, item.widthMm, item.depthMm, item.rotation))}" fill="#d7c6af" stroke="#806c50" stroke-width="35"/>${orientationMarks(item)}`,
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
  const clip = zone?.length ? `<defs><clipPath id="zone"><polygon points="${polygon([...zone])}"/></clipPath></defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" preserveAspectRatio="none" viewBox="${n(view.x)} ${n(view.y)} ${n(view.width)} ${n(view.height)}">${clip}<rect x="${n(view.x)}" y="${n(view.y)}" width="${n(view.width)}" height="${n(view.height)}" fill="${zone ? '#fff' : '#fbfaf7'}"/><g${zone ? ' clip-path="url(#zone)"' : ''}>${walls}${leaves}${kitchenRuns(doc)}${furniture}${columns}${slopes}${stairs}</g></svg>`;
}

export async function rasterizeEditorDocument(doc: EditorDocument, zone?: readonly Point[],
  options: { doorLeaves?: boolean } = {}): Promise<RasterResult> {
  const view = bounds(doc, zone);
  const outWidth =
    view.width >= view.height ? MAX_SIDE : Math.round((MAX_SIDE * view.width) / view.height);
  const outHeight =
    view.height > view.width ? MAX_SIDE : Math.round((MAX_SIDE * view.height) / view.width);
  const png = await sharp(Buffer.from(svg(doc, view, { width: outWidth, height: outHeight }, zone, options.doorLeaves)))
    .resize(outWidth, outHeight, { fit: 'fill' })
    .png()
    .toBuffer();
  return { base64: png.toString('base64'), aspectRatio: toAspectRatio(view.width, view.height) };
}
