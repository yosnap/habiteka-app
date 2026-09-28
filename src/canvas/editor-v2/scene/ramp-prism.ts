/**
 * Rampa local: la flecha 2D avanza de y=profundidad hacia y=0.
 * Por tanto el extremo z positivo está a la cota inicial y el negativo a la final.
 */
export function rampPrismGeometry(width: number, depth: number, rise: number, baseHeight = 0) {
  const halfWidth = width / 2, halfDepth = depth / 2;
  return {
    vertices: new Float32Array([
      -halfWidth, baseHeight + rise, -halfDepth, halfWidth, baseHeight + rise, -halfDepth,
      halfWidth, baseHeight, halfDepth, -halfWidth, baseHeight, halfDepth,
      -halfWidth, 0, -halfDepth, halfWidth, 0, -halfDepth,
      halfWidth, 0, halfDepth, -halfWidth, 0, halfDepth,
    ]),
    // Eight vertices are required once a flight starts above its base. The
    // prior six-vertex wedge reused the low top edge as its bottom edge and
    // left an open face under the second flight.
    indices: new Uint32Array([
      0, 1, 2, 0, 2, 3, // inclined upper face
      4, 6, 5, 4, 7, 6, // underside
      0, 4, 5, 0, 5, 1, // high end
      1, 5, 6, 1, 6, 2, // right side
      2, 6, 7, 2, 7, 3, // low end
      3, 7, 4, 3, 4, 0, // left side
    ]),
  };
}

/** Separate UVs per face keep PBR texture scale physical on the ramp body. */
export function rampBodySurfaceGeometry(width: number, depth: number, rise: number, baseHeight = 0) {
  const x = width / 2, z = depth / 2, high = baseHeight + rise;
  const a = [-x, high, -z], b = [x, high, -z], c = [x, baseHeight, z], d = [-x, baseHeight, z];
  const e = [-x, 0, -z], f = [x, 0, -z], g = [x, 0, z], h = [-x, 0, z];
  const faces = [
    { points: [e, f, g, h], uv: [[0, 0], [width, 0], [width, depth], [0, depth]], normal: [0, -1, 0] },
    { points: [a, b, f, e], uv: [[0, high], [width, high], [width, 0], [0, 0]], normal: [0, 0, -1] },
    { points: [b, c, g, f], uv: [[0, high], [depth, baseHeight], [depth, 0], [0, 0]], normal: [1, 0, 0] },
    { points: [c, d, h, g], uv: [[width, baseHeight], [0, baseHeight], [0, 0], [width, 0]], normal: [0, 0, 1] },
    { points: [d, a, e, h], uv: [[depth, baseHeight], [0, high], [0, 0], [depth, 0]], normal: [-1, 0, 0] },
  ];
  const vertices: number[] = [], uvs: number[] = [], normals: number[] = [], indices: number[] = [];
  faces.forEach(({ points, uv, normal }, face) => {
    points.forEach((point, corner) => {
      vertices.push(...point);
      uvs.push(...uv[corner]!);
      normals.push(...normal);
    });
    const start = face * 4;
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  });
  return { vertices: new Float32Array(vertices), uvs: new Float32Array(uvs),
    normals: new Float32Array(normals), indices: new Uint32Array(indices) };
}

/** La misma cara superior del prisma, elevada imperceptiblemente para evitar z-fighting. */
export function rampSurfaceGeometry(width: number, depth: number, rise: number, baseHeight = 0, offset = .0005) {
  const halfWidth = width / 2, halfDepth = depth / 2;
  const slopeLength = Math.hypot(depth, rise);
  const normalY = depth / slopeLength, normalZ = rise / slopeLength;
  return {
    vertices: new Float32Array([
      -halfWidth, baseHeight + rise + offset, -halfDepth,
      halfWidth, baseHeight + rise + offset, -halfDepth,
      halfWidth, baseHeight + offset, halfDepth,
      -halfWidth, baseHeight + offset, halfDepth,
    ]),
    // UV normalizadas: el material aplica la escala física del ancho y la pendiente.
    uvs: new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]),
    normals: new Float32Array([
      0, normalY, normalZ, 0, normalY, normalZ,
      0, normalY, normalZ, 0, normalY, normalZ,
    ]),
    indices: new Uint32Array([0, 2, 1, 0, 3, 2]),
  };
}
