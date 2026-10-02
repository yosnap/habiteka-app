import { ShapeUtils, Vector2 } from 'three';
import type { Pair, Polygon } from 'polygon-clipping';
export interface RoofPrismGeometry { positions: Float32Array; uvs: Float32Array; indices: Uint32Array; }
function open(ring: Pair[]) {
  return ring.length > 1 && ring[0]![0] === ring.at(-1)![0] && ring[0]![1] === ring.at(-1)![1] ? ring.slice(0, -1) : ring;
}
/** Prisma con altura superior e inferior independientes, recortado por polígonos con huecos. */
export function roofPrismGeometry(parts: Polygon[], world: (u: number, v: number) => [number, number],
  top: (u: number, v: number) => number, bottom: (u: number, v: number) => number): RoofPrismGeometry {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (const part of parts) {
    const rings = part.map(open), points = rings.flat(), start = positions.length / 3, count = points.length;
    for (const height of [top, bottom]) for (const [u, v] of points) {
      const [x, z] = world(u, v); positions.push(x, height(u, v), z); uvs.push(u, v);
    }
    const triangles = ShapeUtils.triangulateShape(rings[0]!.map(p => new Vector2(...p)), rings.slice(1).map(ring => ring.map(p => new Vector2(...p))));
    for (const [a, b, c] of triangles) indices.push(start + a!, start + c!, start + b!, start + count + a!, start + count + b!, start + count + c!);
    let offset = 0;
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const a = start + offset + i, b = start + offset + (i + 1) % ring.length;
        indices.push(a, b, b + count, a, b + count, a + count);
      }
      offset += ring.length;
    }
  }
  return { positions: new Float32Array(positions), uvs: new Float32Array(uvs), indices: new Uint32Array(indices) };
}
