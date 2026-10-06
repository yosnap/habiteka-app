import type { EditorDocument } from '@/lib/editor-document/schema';
import type { EditorBackground } from '@/lib/studio-state';
import type { SketchWall } from '@/server/ai/sketch/sketch-types';
import { detectWallsFromImage } from './detect-walls-raster';

/** Menos muros que esto en la imagen no permiten alinearla con el plano. */
const MIN_WALLS = 4;
/** Dos trazos a menos de esta distancia (fracción de la imagen) forman parte del mismo dibujo. */
const JOIN = 0.02;
/** Resolución del mapa de distancias con el que se afina el encaje. */
const GRID = 240;

type Frame = EditorBackground['frame'];
interface Box { minX: number; maxX: number; minY: number; maxY: number }

/**
 * Encuadre de una imagen (el boceto o un redibujado que no se extrajo) como fondo del editor, sin IA. Primero encaja el
 * contorno del dibujo de la casa (el mayor grupo de muros conectados: los subrayados de títulos o la flecha del norte
 * quedan fuera) con el de los muros del plano; después afina escala y posición de cada eje para que los muros del plano
 * caigan sobre los trazos de la imagen, aunque el boceto no tenga sus proporciones exactas.
 */
export async function fitBackgroundFrame(image: Buffer, document: EditorDocument): Promise<Frame> {
  const detected = await detectWallsFromImage(image);
  const house = largestGroup(detected.walls);
  if (house.length < MIN_WALLS) throw new Error('No se ven muros suficientes en esta imagen para alinearla con el plano.');
  const vertices = new Map(document.vertices.map((vertex) => [vertex.id, vertex]));
  const segments = document.walls.flatMap((wall) => {
    const a = vertices.get(wall.startVertexId), b = vertices.get(wall.endVertexId);
    return a && b ? [{ x1: a.x, y1: a.y, x2: b.x, y2: b.y }] : [];
  });
  if (segments.length < 2) throw new Error('El plano del editor no tiene muros con los que alinear la imagen.');
  const drawn = bounds(house.flatMap((wall) => [[wall.x1, wall.y1], [wall.x2, wall.y2]]));
  const plan = bounds(segments.flatMap((wall) => [[wall.x1, wall.y1], [wall.x2, wall.y2]]));
  if (drawn.maxX - drawn.minX < 0.05 || drawn.maxY - drawn.minY < 0.05)
    throw new Error('Los muros de esta imagen ocupan demasiado poco para alinearla con el plano.');
  const width = (plan.maxX - plan.minX) / (drawn.maxX - drawn.minX), height = (plan.maxY - plan.minY) / (drawn.maxY - drawn.minY);
  const initial = { x: plan.minX - drawn.minX * width, y: plan.minY - drawn.minY * height, width, height };
  return refine(initial, segments, distanceMap(detected.walls));
}

/** Grupo de trazos conectados con más longitud: el dibujo de la casa. */
function largestGroup(walls: readonly SketchWall[]): SketchWall[] {
  const parent = walls.map((_, index) => index);
  const find = (index: number): number => parent[index] === index ? index : (parent[index] = find(parent[index]!));
  for (let i = 0; i < walls.length; i++) for (let j = i + 1; j < walls.length; j++)
    if (segmentDistance(walls[i]!, walls[j]!) < JOIN) parent[find(i)] = find(j);
  const length = new Map<number, number>();
  walls.forEach((wall, index) => length.set(find(index), (length.get(find(index)) ?? 0) + Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)));
  const best = [...length].sort((a, b) => b[1] - a[1])[0]?.[0];
  return walls.filter((_, index) => find(index) === best);
}

/** Distancia (fracción de la imagen) desde cada celda al trazo detectado más cercano. */
function distanceMap(walls: readonly SketchWall[]): Float32Array {
  const map = new Float32Array(GRID * GRID).fill(Infinity);
  for (const wall of walls) {
    const steps = Math.ceil(Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) * GRID * 2) + 1;
    for (let step = 0; step <= steps; step++) {
      const t = step / steps, x = Math.round((wall.x1 + (wall.x2 - wall.x1) * t) * (GRID - 1)), y = Math.round((wall.y1 + (wall.y2 - wall.y1) * t) * (GRID - 1));
      if (x >= 0 && y >= 0 && x < GRID && y < GRID) map[y * GRID + x] = 0;
    }
  }
  // Transformada de distancia en dos pasadas (aproximación de chaflán).
  const at = (x: number, y: number) => map[y * GRID + x]!;
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
    let value = at(x, y);
    if (x > 0) value = Math.min(value, at(x - 1, y) + 1);
    if (y > 0) value = Math.min(value, at(x, y - 1) + 1, x > 0 ? at(x - 1, y - 1) + 1.414 : Infinity, x < GRID - 1 ? at(x + 1, y - 1) + 1.414 : Infinity);
    map[y * GRID + x] = value;
  }
  for (let y = GRID - 1; y >= 0; y--) for (let x = GRID - 1; x >= 0; x--) {
    let value = at(x, y);
    if (x < GRID - 1) value = Math.min(value, at(x + 1, y) + 1);
    if (y < GRID - 1) value = Math.min(value, at(x, y + 1) + 1, x < GRID - 1 ? at(x + 1, y + 1) + 1.414 : Infinity, x > 0 ? at(x - 1, y + 1) + 1.414 : Infinity);
    map[y * GRID + x] = value;
  }
  return map.map((value) => value / GRID);
}

/** Ajusta escala y posición de cada eje para acercar los muros del plano a los trazos de la imagen. */
function refine(frame: Frame, segments: readonly { x1: number; y1: number; x2: number; y2: number }[], map: Float32Array): Frame {
  const samples = segments.flatMap((wall) => {
    const count = Math.max(2, Math.ceil(Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) / 150));
    return Array.from({ length: count + 1 }, (_, i) => [wall.x1 + (wall.x2 - wall.x1) * i / count, wall.y1 + (wall.y2 - wall.y1) * i / count] as const);
  });
  // Distancias recortadas: un muro del plano que el dibujo no tiene (un cerramiento del patio) no arrastra el encaje.
  const score = (candidate: Frame) => samples.reduce((sum, [x, y]) => {
    const u = (x - candidate.x) / candidate.width, v = (y - candidate.y) / candidate.height;
    if (u < 0 || v < 0 || u > 1 || v > 1) return sum + 0.03;
    return sum + Math.min(0.03, map[Math.round(v * (GRID - 1)) * GRID + Math.round(u * (GRID - 1))]!);
  }, 0);
  let best = frame, bestScore = score(frame);
  for (const factor of [0.04, 0.02, 0.01, 0.005, 0.0025]) {
    for (let improved = true, rounds = 0; improved && rounds < 30; rounds++) {
      improved = false;
      const moves: Frame[] = [];
      for (const sign of [-1, 1]) {
        moves.push({ ...best, x: best.x + sign * factor * best.width }, { ...best, y: best.y + sign * factor * best.height });
        // Escalar desde el centro del plano: cambia el tamaño sin desplazarlo.
        const sx = 1 + sign * factor, sy = 1 + sign * factor;
        moves.push({ ...best, width: best.width * sx, x: best.x + best.width * (1 - sx) / 2 },
          { ...best, height: best.height * sy, y: best.y + best.height * (1 - sy) / 2 });
      }
      for (const move of moves) {
        const value = score(move);
        if (value < bestScore - 1e-9) { best = move; bestScore = value; improved = true; }
      }
    }
  }
  return best;
}

function bounds(points: readonly (readonly number[])[]): Box {
  const xs = points.map((point) => point[0]!), ys = points.map((point) => point[1]!);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function segmentDistance(a: SketchWall, b: SketchWall): number {
  if (segmentsCross(a, b)) return 0;
  return Math.min(pointToSegment(a.x1, a.y1, b), pointToSegment(a.x2, a.y2, b), pointToSegment(b.x1, b.y1, a), pointToSegment(b.x2, b.y2, a));
}

function pointToSegment(x: number, y: number, s: SketchWall): number {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((x - s.x1) * dx + (y - s.y1) * dy) / length)) : 0;
  return Math.hypot(x - (s.x1 + t * dx), y - (s.y1 + t * dy));
}

function segmentsCross(a: SketchWall, b: SketchWall): boolean {
  const side = (px: number, py: number, s: SketchWall) => (s.x2 - s.x1) * (py - s.y1) - (s.y2 - s.y1) * (px - s.x1);
  return side(a.x1, a.y1, b) * side(a.x2, a.y2, b) < 0 && side(b.x1, b.y1, a) * side(b.x2, b.y2, a) < 0;
}
