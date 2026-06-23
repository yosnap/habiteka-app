/**
 * Deriva el POLÍGONO DEL SUELO a partir de los muros del plano (puro, sin React/Three).
 *
 * El suelo de una sala es la HUELLA encerrada por sus muros: el interior más los propios
 * muros. En vez de fiarse de un `floorOutline` que se congela al crear la sala (y diverge
 * en cuanto el usuario edita un muro), aquí se reconstruye de los muros ACTUALES, de modo
 * que el 3D sigue siempre al 2D.
 *
 * Método (robusto a muros de distinto grosor o editados a mano): se rasteriza la zona a una
 * rejilla fina; se marca el EXTERIOR con un flood-fill desde el borde por las celdas libres
 * (sin muro); la huella de la sala = todo lo que NO es exterior (interior encerrado + muros).
 * De esa región se extrae su contorno como un polígono rectilíneo (aristas de celda del
 * borde, encadenadas). Es O(celdas): fiable y sin los casos límite de la geometría analítica
 * de unión de rectángulos.
 */
import type { StructObj } from '../types';

/** Rectángulo axis-aligned en px. */
interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Punto en px. */
export interface FloorPoint {
  x: number;
  y: number;
}

/** AABB de un muro respetando su rotación (las 4 esquinas rotadas sobre su origen). */
function wallAabb(o: StructObj): Rect {
  const rad = (o.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const offsets: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [o.width, 0],
    [o.width, o.height],
    [0, o.height],
  ];
  const corners = offsets.map(
    ([dx, dy]) => [o.x + dx * cos - dy * sin, o.y + dx * sin + dy * cos] as const,
  );
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of corners) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Polígono del suelo (px) derivado de los muros. Devuelve `null` si no hay muros suficientes
 * o la huella es degenerada (el caller cae al suelo rectangular / floorOutline).
 *
 * `cell` es el tamaño de celda de la rejilla en px (resolución del contorno). Por defecto
 * media decena de px, fino frente al grosor típico de muro (~15 px) para no comerse esquinas.
 */
export function floorPolygonFromWalls(walls: StructObj[], cell = 5): FloorPoint[] | null {
  if (walls.length < 3) return null;
  const rects = walls.map(wallAabb);

  // Bounding box global con un anillo de margen (para que el flood-fill exterior rodee todo).
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.minX);
    minY = Math.min(minY, r.minY);
    maxX = Math.max(maxX, r.maxX);
    maxY = Math.max(maxY, r.maxY);
  }
  if (!Number.isFinite(minX) || maxX - minX < cell || maxY - minY < cell) return null;

  const pad = cell; // un anillo de celdas libres alrededor para iniciar el flood exterior
  const ox = minX - pad;
  const oy = minY - pad;
  const cols = Math.ceil((maxX - minX + 2 * pad) / cell);
  const rows = Math.ceil((maxY - minY + 2 * pad) / cell);
  // Guardia de tamaño: salas enormes a resolución fina podrían crear rejillas gigantes.
  if (cols * rows > 1_000_000) return null;

  // wall[i] = ¿la celda i está cubierta por algún muro? (centro de celda dentro de un rect)
  const isWall = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const cy = oy + (r + 0.5) * cell;
    for (let c = 0; c < cols; c++) {
      const cx = ox + (c + 0.5) * cell;
      for (const rect of rects) {
        if (cx >= rect.minX && cx <= rect.maxX && cy >= rect.minY && cy <= rect.maxY) {
          isWall[r * cols + c] = 1;
          break;
        }
      }
    }
  }

  // Flood-fill del EXTERIOR: celdas libres alcanzables desde la esquina (0,0) del anillo.
  const exterior = new Uint8Array(cols * rows);
  const stack: number[] = [0];
  exterior[0] = 1;
  while (stack.length) {
    const idx = stack.pop()!;
    const c = idx % cols;
    const r = (idx - c) / cols;
    const neighbors: ReadonlyArray<readonly [number, number]> = [
      [c - 1, r],
      [c + 1, r],
      [c, r - 1],
      [c, r + 1],
    ];
    for (const [nc, nr] of neighbors) {
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const ni = nr * cols + nc;
      if (exterior[ni] || isWall[ni]) continue;
      exterior[ni] = 1;
      stack.push(ni);
    }
  }

  // Huella de la sala = NO exterior (interior encerrado + muros). Extraer su contorno como
  // las aristas de celda que separan huella de exterior/fuera de rejilla, encadenadas.
  const inFootprint = (c: number, r: number): boolean => {
    if (c < 0 || r < 0 || c >= cols || r >= rows) return false;
    return exterior[r * cols + c] === 0;
  };

  // Recolecta las aristas del borde de la huella como segmentos (en coords px), orientadas
  // para que la huella quede a la izquierda; luego se encadenan en un polígono.
  const edges = new Map<string, FloorPoint>(); // clave de vértice "x,y" → siguiente vértice
  const key = (p: FloorPoint) => `${p.x},${p.y}`;
  const addEdge = (a: FloorPoint, b: FloorPoint) => edges.set(key(a), b);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!inFootprint(c, r)) continue;
      const x0 = ox + c * cell;
      const y0 = oy + r * cell;
      const x1 = x0 + cell;
      const y1 = y0 + cell;
      // Para cada lado de la celda que limita con NO-huella, añade la arista orientada CW
      // (huella a la izquierda al recorrer): top→right→bottom→left.
      if (!inFootprint(c, r - 1)) addEdge({ x: x0, y: y0 }, { x: x1, y: y0 }); // arriba: →
      if (!inFootprint(c + 1, r)) addEdge({ x: x1, y: y0 }, { x: x1, y: y1 }); // derecha: ↓
      if (!inFootprint(c, r + 1)) addEdge({ x: x1, y: y1 }, { x: x0, y: y1 }); // abajo: ←
      if (!inFootprint(c - 1, r)) addEdge({ x: x0, y: y1 }, { x: x0, y: y0 }); // izquierda: ↑
    }
  }
  if (edges.size === 0) return null;

  // Encadena las aristas en un anillo y simplifica los puntos colineales.
  const start = edges.keys().next().value as string;
  const [sx, sy] = start.split(',').map(Number);
  let current: FloorPoint = { x: sx!, y: sy! };
  const ring: FloorPoint[] = [current];
  for (let i = 0; i < edges.size; i++) {
    const nxt = edges.get(key(current));
    if (!nxt) break;
    if (nxt.x === ring[0]!.x && nxt.y === ring[0]!.y) break; // cerró el anillo
    ring.push(nxt);
    current = nxt;
  }
  return simplifyColinear(ring);
}

/** Quita vértices intermedios colineales (3 puntos en la misma recta horizontal/vertical). */
function simplifyColinear(pts: FloorPoint[]): FloorPoint[] {
  const n = pts.length;
  if (n < 3) return pts;
  const out: FloorPoint[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]!;
    const cur = pts[i]!;
    const next = pts[(i + 1) % n]!;
    const colinear =
      (prev.x === cur.x && cur.x === next.x) || (prev.y === cur.y && cur.y === next.y);
    if (!colinear) out.push(cur);
  }
  return out.length >= 3 ? out : pts;
}
