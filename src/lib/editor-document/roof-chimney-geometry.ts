import type { RoofPrismGeometry } from './roof-prism-geometry';

/** UV por cara en metros: las juntas del ladrillo suben por el conducto, sin estirarse desde el plano XY. */
export function chimneyFaceUvs(source: RoofPrismGeometry): RoofPrismGeometry {
  const positions: number[] = [], uvs: number[] = [];
  const vertex = (index: number) => [source.positions[index * 3]!, source.positions[index * 3 + 1]!, source.positions[index * 3 + 2]!] as const;
  for (let i = 0; i < source.indices.length; i += 3) {
    const points = [vertex(source.indices[i]!), vertex(source.indices[i + 1]!), vertex(source.indices[i + 2]!)];
    const [a, b, c] = points;
    const ux = b![0] - a![0], uy = b![1] - a![1], uz = b![2] - a![2];
    const vx = c![0] - a![0], vy = c![1] - a![1], vz = c![2] - a![2];
    const nx = Math.abs(uy * vz - uz * vy), ny = Math.abs(uz * vx - ux * vz), nz = Math.abs(ux * vy - uy * vx);
    for (const p of points) {
      positions.push(...p);
      uvs.push(ny >= Math.max(nx, nz) ? p[0] : nx >= nz ? p[2] : p[0], ny >= Math.max(nx, nz) ? p[2] : p[1]);
    }
  }
  return { positions: new Float32Array(positions), uvs: new Float32Array(uvs), indices: Uint32Array.from({ length: positions.length / 3 }, (_, index) => index) };
}
