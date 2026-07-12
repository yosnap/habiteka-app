/**
 * Limpieza topológica de los muros extraídos de un boceto (espacio de imagen
 * 0–1, puro y determinista). Corrige dos defectos sistemáticos de los modelos
 * de visión sobre dibujos a mano:
 *
 *  - Devuelven las DOS CARAS de un muro grueso como dos segmentos paralelos →
 *    `collapseDoubleWalls` las funde en su eje central.
 *  - Trocean un muro recto en varios fragmentos → `mergeCollinear` encadena
 *    los tramos colineales que comparten extremo en un solo segmento.
 */
import type { SketchPoint, SketchWall } from './sketch-types';

interface Vec {
  x: number;
  y: number;
}

function length(w: SketchWall): number {
  return Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
}

function unitDir(w: SketchWall): Vec | null {
  const len = length(w);
  if (len < 1e-9) return null;
  return { x: (w.x2 - w.x1) / len, y: (w.y2 - w.y1) / len };
}

function isParallel(a: Vec, b: Vec, tolDeg: number): boolean {
  const cross = Math.abs(a.x * b.y - a.y * b.x);
  return cross <= Math.sin((tolDeg * Math.PI) / 180);
}

/**
 * Funde pares de muros paralelos, muy próximos y con solape de recorrido en un
 * único muro sobre la línea media, abarcando la unión de ambos tramos. Itera
 * hasta que no queda nada que fundir.
 */
export function collapseDoubleWalls(
  walls: SketchWall[],
  maxGap: number,
  tolDeg: number,
): SketchWall[] {
  const out = [...walls];
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < out.length; i++) {
      const a = out[i]!;
      const da = unitDir(a);
      if (!da) continue;
      const n = { x: -da.y, y: da.x };
      const proj = (p: SketchPoint) => (p.x - a.x1) * da.x + (p.y - a.y1) * da.y;
      const off = (p: SketchPoint) => (p.x - a.x1) * n.x + (p.y - a.y1) * n.y;

      for (let j = i + 1; j < out.length; j++) {
        const b = out[j]!;
        const db = unitDir(b);
        if (!db || !isParallel(da, db, tolDeg)) continue;

        const off1 = off({ x: b.x1, y: b.y1 });
        const off2 = off({ x: b.x2, y: b.y2 });
        if ((Math.abs(off1) + Math.abs(off2)) / 2 > maxGap) continue;

        // Solape de recorrido sobre el eje de `a`: sin solape suficiente son
        // muros distintos (p. ej. dos tabiques paralelos de una misma sala).
        const ia: [number, number] = [0, length(a)];
        const tb = [proj({ x: b.x1, y: b.y1 }), proj({ x: b.x2, y: b.y2 })].sort((p, q) => p - q) as [
          number,
          number,
        ];
        const overlap = Math.min(ia[1], tb[1]) - Math.max(ia[0], tb[0]);
        if (overlap < 0.4 * Math.min(length(a), length(b))) continue;

        // Línea media entre ambas caras, abarcando la unión de los recorridos.
        const mid = (off1 + off2) / 4; // la cara de `a` está en offset 0
        const tMin = Math.min(ia[0], tb[0]);
        const tMax = Math.max(ia[1], tb[1]);
        out[i] = {
          x1: a.x1 + da.x * tMin + n.x * mid,
          y1: a.y1 + da.y * tMin + n.y * mid,
          x2: a.x1 + da.x * tMax + n.x * mid,
          y2: a.y1 + da.y * tMax + n.y * mid,
        };
        out.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }
  return out;
}

/**
 * Fusiona cadenas de segmentos colineales que comparten un extremo (con
 * tolerancia) y se extienden a lados opuestos de ese punto: un muro recto que
 * el modelo troceó vuelve a ser un único segmento.
 */
export function mergeCollinear(walls: SketchWall[], tolDeg: number, joinTol: number): SketchWall[] {
  const out = [...walls];
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < out.length; i++) {
      const a = out[i]!;
      const da = unitDir(a);
      if (!da) continue;
      for (let j = i + 1; j < out.length; j++) {
        const b = out[j]!;
        const db = unitDir(b);
        if (!db || !isParallel(da, db, tolDeg)) continue;

        const joint = sharedEndpoint(a, b, joinTol);
        if (!joint) continue;
        const [farA, farB, shared] = joint;
        // Deben salir hacia lados opuestos del punto común; si salen hacia el
        // mismo lado son el mismo tramo duplicado, no una cadena.
        const dot =
          (farA.x - shared.x) * (farB.x - shared.x) + (farA.y - shared.y) * (farB.y - shared.y);
        if (dot >= 0) continue;

        out[i] = { x1: farA.x, y1: farA.y, x2: farB.x, y2: farB.y };
        out.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }
  return out;
}

/** Extremo compartido entre dos segmentos: [lejano de a, lejano de b, común]. */
function sharedEndpoint(
  a: SketchWall,
  b: SketchWall,
  tol: number,
): [SketchPoint, SketchPoint, SketchPoint] | null {
  const ends = (w: SketchWall): [SketchPoint, SketchPoint] => [
    { x: w.x1, y: w.y1 },
    { x: w.x2, y: w.y2 },
  ];
  const [a1, a2] = ends(a);
  const [b1, b2] = ends(b);
  for (const [pa, farA] of [
    [a1, a2],
    [a2, a1],
  ] as const) {
    for (const [pb, farB] of [
      [b1, b2],
      [b2, b1],
    ] as const) {
      if (Math.hypot(pa.x - pb.x, pa.y - pb.y) <= tol) return [farA, farB, pa];
    }
  }
  return null;
}
