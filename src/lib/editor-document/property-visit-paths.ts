import type { Point } from './schema';
import { distance } from './geometry';
import type { walkthroughNavigation } from './walkthrough-navigation';

/** Un árbol de caminos compartido evita repetir A* decenas de veces por cada zona aislada. */
export function propertyVisitPaths(nav: ReturnType<typeof walkthroughNavigation>, origin: Point, step = 150) {
  const limit = 60000;
  const boundary = nav.rooms.flatMap(room => room.boundary);
  const minX = Math.min(origin.x, ...boundary.map(point => point.x)) - step;
  const maxX = Math.max(origin.x, ...boundary.map(point => point.x)) + step;
  const minY = Math.min(origin.y, ...boundary.map(point => point.y)) - step;
  const maxY = Math.max(origin.y, ...boundary.map(point => point.y)) + step;
  const key = (x: number, y: number) => `${x},${y}`;
  const point = (id: string): Point => { const [x, y] = id.split(',').map(Number); return { x: origin.x + x! * step, y: origin.y + y! * step }; };
  const queue = ['0,0'], parents = new Map<string, string | null>([['0,0', null]]);
  const free = new Map<string, boolean>();
  if (!nav.free(origin)) throw new Error('La entrada interior está bloqueada.');
  let visited = 0;
  for (; visited < queue.length && visited < limit; visited++) {
    const id = queue[visited]!, p = point(id), [x, y] = id.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = key(x! + dx!, y! + dy!);
      if (parents.has(next)) continue;
      const q = point(next);
      if (q.x < minX || q.x > maxX || q.y < minY || q.y > maxY) continue;
      if (!free.has(next)) free.set(next, nav.free(q));
      if (!free.get(next) || !nav.segmentFree(p, q)) continue;
      parents.set(next, id); queue.push(next);
    }
  }
  const reached = queue.slice(0, visited).map(id => ({ id, point: point(id) }));
  const chain = (id: string) => {
    const result: string[] = [];
    for (let cursor: string | null = id; cursor !== null; cursor = parents.get(cursor) ?? null) result.push(cursor);
    return result;
  };
  const shortest = (from: string, to: string): string[] | null => {
    const target = point(to), open = new Set([from]), costs = new Map([[from, 0]]), previous = new Map<string, string>();
    for (let iterations = 0; open.size && iterations < 60000; iterations++) {
      let current = '', score = Infinity;
      for (const id of open) {
        const p = point(id), value = costs.get(id)! + Math.abs(p.x - target.x) + Math.abs(p.y - target.y);
        if (value < score) { score = value; current = id; }
      }
      if (current === to) {
        const result = [to];
        while (result[0] !== from) result.unshift(previous.get(result[0]!)!);
        return result;
      }
      open.delete(current);
      const [x, y] = current.split(',').map(Number), p = point(current);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = key(x! + dx!, y! + dy!), cost = costs.get(current)! + step;
        if (!parents.has(next) || cost >= (costs.get(next) ?? Infinity) || !nav.segmentFree(p, point(next))) continue;
        costs.set(next, cost); previous.set(next, current); open.add(next);
      }
    }
    return null;
  };
  return {
    reached, limited: visited < queue.length,
    between(from: string, to: string): Point[] {
      if (nav.segmentFree(point(from), point(to))) return [point(from), point(to)];
      const a = chain(from), b = chain(to), ancestors = new Set(a);
      const common = b.find(id => ancestors.has(id));
      if (!common) throw new Error('No hay conexión con la entrada.');
      const path = (shortest(from, to) ?? [...a.slice(0, a.indexOf(common) + 1), ...b.slice(0, b.indexOf(common)).reverse()]).map(point);
      const simplified = [path[0]!];
      for (let i = 0; i < path.length - 1;) {
        // Limitar la búsqueda de atajos conserva tiempos acotados en inmuebles grandes.
        let next = Math.min(path.length - 1, i + 60);
        while (next > i + 1 && !nav.segmentFree(path[i]!, path[next]!)) next--;
        if (distance(simplified.at(-1)!, path[next]!) > .01) simplified.push(path[next]!);
        i = next;
      }
      return simplified;
    },
  };
}
