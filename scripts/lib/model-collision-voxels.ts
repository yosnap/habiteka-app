import { Box3, Triangle, Vector3 } from 'three';

export type ProxyBox = [number, number, number, number, number, number];
/** Rasteriza superficies reales, rellena interiores cerrados y conserva los huecos conectados al exterior. */
export function collisionVoxels(triangles: Triangle[], bounds: Box3, cellMm = 20) {
  const size = bounds.getSize(new Vector3());
  const grid = [size.x, size.z, size.y].map((value) => Math.max(1, Math.ceil(value * 1000 / cellMm)));
  const [nx, ny, nz] = grid as [number, number, number], sx = nx + 2, sy = ny + 2, sz = nz + 2;
  const cells = new Uint8Array(sx * sy * sz), stride = sx * sy;
  const index = (x: number, y: number, z: number) => x + sx * y + stride * z;
  const cellSize = new Vector3(size.x / nx, size.y / nz, size.z / ny);
  const box = new Box3(), triangleBounds = new Box3();
  for (const triangle of triangles) {
    triangleBounds.setFromPoints([triangle.a, triangle.b, triangle.c]);
    const start = triangleBounds.min.clone().sub(bounds.min).divide(cellSize);
    const end = triangleBounds.max.clone().sub(bounds.min).divide(cellSize);
    // Incluye la celda anterior cuando una cara cae exactamente sobre un límite, también en el máximo del modelo.
    for (let z = Math.max(0, Math.floor(start.y - 1e-7)); z <= Math.min(nz - 1, Math.floor(end.y + 1e-7)); z++)
      for (let y = Math.max(0, Math.floor(start.z - 1e-7)); y <= Math.min(ny - 1, Math.floor(end.z + 1e-7)); y++)
        for (let x = Math.max(0, Math.floor(start.x - 1e-7)); x <= Math.min(nx - 1, Math.floor(end.x + 1e-7)); x++) {
          const key = index(x + 1, y + 1, z + 1);
          if (cells[key]) continue;
          box.min.set(bounds.min.x + x * cellSize.x, bounds.min.y + z * cellSize.y, bounds.min.z + y * cellSize.z);
          box.max.copy(box.min).add(cellSize);
          if (box.intersectsTriangle(triangle)) cells[key] = 1;
        }
  }
  // Una celda de margen permite entrar al exterior aunque el modelo llegue hasta sus límites.
  const queue = new Int32Array(cells.length); let read = 0, write = 1; queue[0] = 0; cells[0] = 2;
  const visit = (key: number) => { if (!cells[key]) { cells[key] = 2; queue[write++] = key; } };
  while (read < write) {
    const key = queue[read++]!, x = key % sx, y = Math.floor(key / sx) % sy, z = Math.floor(key / stride);
    if (x > 0) visit(key - 1); if (x < sx - 1) visit(key + 1);
    if (y > 0) visit(key - sx); if (y < sy - 1) visit(key + sx);
    if (z > 0) visit(key - stride); if (z < sz - 1) visit(key + stride);
  }
  const boxes: ProxyBox[] = [], lastLayer = new Map<string, ProxyBox>();
  for (let z = 0; z < nz; z++) {
    const layer = new Uint8Array(nx * ny), currentLayer = new Map<string, ProxyBox>();
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++)
      layer[x + nx * y] = cells[index(x + 1, y + 1, z + 1)] === 2 ? 0 : 1;
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      if (!layer[x + nx * y]) continue;
      let width = 1, depth = 1;
      while (x + width < nx && layer[x + width + nx * y]) width++;
      while (y + depth < ny && Array.from({ length: width }, (_, i) => layer[x + i + nx * (y + depth)]).every(Boolean)) depth++;
      for (let j = 0; j < depth; j++) layer.fill(0, x + nx * (y + j), x + width + nx * (y + j));
      const key = `${x},${y},${width},${depth}`, previous = lastLayer.get(key);
      const solid: ProxyBox = previous ?? [x, y, z, width, depth, 0];
      solid[5]++; currentLayer.set(key, solid);
      if (!previous) boxes.push(solid);
    }
    lastLayer.clear(); currentLayer.forEach((solid, key) => lastLayer.set(key, solid));
  }
  return { grid, cellMm, boxes };
}
