import sharp from 'sharp';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import type { SceneBox, ScenePolygon, SceneRamp } from '@/canvas/editor-v2/scene/types';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { toAspectRatio, type RasterResult } from '../canvas/rasterize-canvas-doc';

type Point3 = { x: number; y: number; z: number };
type Point2 = { x: number; y: number };
export type StructureView = 'front' | 'reverse';

const SIZE = 1280;
const PAD = 0.8;

/** Proyección axonométrica sin WebGL: referencia geométrica para el proveedor IA. */
export async function rasterizeEditorStructure(
  doc: EditorDocument,
  view: StructureView = 'front',
): Promise<RasterResult> {
  const scene = editorDocumentToScene(doc);
  const solids = [
    ...scene.polygons.map(polygonSolid),
    ...scene.boxes.map(boxSolid),
    ...scene.ramps.map(rampSolid),
  ];
  const points = solids.flatMap((solid) => solid.points);
  const projected = points.map((point) => project(point, view));
  const bounds = boundsOf(projected);
  const aspectRatio = toAspectRatio(bounds.width, bounds.height);
  const svg = renderSvg(solids, bounds, view);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return { base64: png.toString('base64'), aspectRatio };
}

interface Solid {
  role: 'floor' | 'column' | 'ramp' | 'stairs' | 'wall' | 'other';
  color: string;
  points: Point3[];
  faces: number[][];
}

function polygonSolid(polygon: ScenePolygon): Solid {
  const bottom = polygon.points.map((point) => ({ x: point.x, y: polygon.elevation, z: point.y }));
  const top = bottom.map((point) => ({ ...point, y: point.y + polygon.height }));
  const count = top.length;
  return {
    role: polygon.role === 'floor' ? 'floor' : polygon.role === 'wall' ? 'wall' : 'other',
    color: polygon.sideColor ?? polygon.color,
    points: [...bottom, ...top],
    faces: [
      Array.from({ length: count }, (_, index) => count + index),
      ...bottom.map((_, index) => [
        index,
        (index + 1) % count,
        count + ((index + 1) % count),
        count + index,
      ]),
    ],
  };
}

function boxSolid(box: SceneBox): Solid {
  const [width, height, depth] = box.size;
  const [x, y, z] = box.position;
  const cos = Math.cos(box.rotation),
    sin = Math.sin(box.rotation);
  const local: Array<[number, number, number]> = [
    [-width / 2, -height / 2, -depth / 2],
    [width / 2, -height / 2, -depth / 2],
    [width / 2, -height / 2, depth / 2],
    [-width / 2, -height / 2, depth / 2],
    [-width / 2, height / 2, -depth / 2],
    [width / 2, height / 2, -depth / 2],
    [width / 2, height / 2, depth / 2],
    [-width / 2, height / 2, depth / 2],
  ];
  return {
    role:
      box.role === 'column'
        ? 'column'
        : box.role === 'step' || box.role === 'landing'
          ? 'stairs'
          : box.role === 'wall'
            ? 'wall'
            : 'other',
    color: box.color,
    points: local.map(([dx, dy, dz]) => ({
      x: x + dx * cos + dz * sin,
      y: y + dy,
      z: z - dx * sin + dz * cos,
    })),
    faces: [
      [4, 5, 6, 7],
      [0, 1, 5, 4],
      [1, 2, 6, 5],
      [2, 3, 7, 6],
      [3, 0, 4, 7],
    ],
  };
}

function rampSolid(ramp: SceneRamp): Solid {
  const halfWidth = ramp.width / 2,
    halfDepth = ramp.depth / 2;
  const local: Array<[number, number, number]> = [
    [-halfWidth, 0, -halfDepth],
    [halfWidth, 0, -halfDepth],
    [halfWidth, 0, halfDepth],
    [-halfWidth, 0, halfDepth],
    [-halfWidth, ramp.baseHeight + ramp.rise, -halfDepth],
    [halfWidth, ramp.baseHeight + ramp.rise, -halfDepth],
    [halfWidth, ramp.baseHeight, halfDepth],
    [-halfWidth, ramp.baseHeight, halfDepth],
  ];
  const [x, y, z] = ramp.position,
    cos = Math.cos(ramp.rotation),
    sin = Math.sin(ramp.rotation);
  return {
    role: 'ramp',
    color: ramp.color,
    points: local.map(([dx, dy, dz]) => ({
      x: x + dx * cos + dz * sin,
      y: y + dy,
      z: z - dx * sin + dz * cos,
    })),
    faces: [
      [4, 5, 6, 7],
      [0, 1, 5, 4],
      [1, 2, 6, 5],
      [2, 3, 7, 6],
      [3, 0, 4, 7],
    ],
  };
}

function project(point: Point3, view: StructureView): Point2 {
  const x = view === 'front' ? point.x : -point.x;
  return { x: (x - point.z) * 0.866, y: (x + point.z) * 0.5 - point.y };
}

function boundsOf(points: Point2[]) {
  const safe = points.length
    ? points
    : [
        { x: 0, y: 0 },
        { x: 8, y: 6 },
      ];
  const xs = safe.map((point) => point.x),
    ys = safe.map((point) => point.y);
  const minX = Math.min(...xs) - PAD,
    maxX = Math.max(...xs) + PAD;
  const minY = Math.min(...ys) - PAD,
    maxY = Math.max(...ys) + PAD;
  return { minX, minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

function renderSvg(
  solids: Solid[],
  bounds: ReturnType<typeof boundsOf>,
  view: StructureView,
): string {
  const scale = Math.min(SIZE / bounds.width, SIZE / bounds.height);
  const width = Math.ceil(bounds.width * scale),
    height = Math.ceil(bounds.height * scale);
  const ordered = solids
    .flatMap((solid) =>
      solid.faces.map((face) => ({
        solid,
        face,
        depth:
          face.reduce((total, index) => total + project(solid.points[index]!, view).y, 0) / face.length,
      })),
    )
    .sort((a, b) => a.depth - b.depth);
  const faces = ordered
    .map(({ solid, face }) => {
      const points = face.map((index) => project(solid.points[index]!, view));
      const polygon = points
        .map(
          (point) =>
            `${((point.x - bounds.minX) * scale).toFixed(1)},${((point.y - bounds.minY) * scale).toFixed(1)}`,
        )
        .join(' ');
      const fill =
        face[0]! >= 4 ? solid.color : shade(solid.color, solid.role === 'floor' ? -0.2 : -0.12);
      return `<polygon points="${polygon}" fill="${fill}" stroke="#33403d" stroke-width="1.4"/>`;
    })
    .join('');
  // La referencia de imagen no lleva títulos ni cotas: los modelos img2img
  // tienden a copiarlos como rótulos visibles en el render final.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#eff3f0"/><g>${faces}</g></svg>`;
}

function shade(hex: string, amount: number): string {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  if (!Number.isFinite(value)) return '#8c918d';
  const channel = (shift: number) =>
    Math.max(0, Math.min(255, ((value >> shift) & 255) * (1 + amount)))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}
