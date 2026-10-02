import { CatmullRomCurve3, Vector3 } from 'three';
import type { EditorDocument } from './schema';
import type { WalkthroughPath } from './walkthrough';
import { walkthroughNavigation, type WalkBlock } from './walkthrough-navigation';
import { distance } from './geometry';
import { buildBuildingWalkthrough } from './building-walkthrough-geometry';
import { compileWalkthroughSamples, type WalkthroughSample } from './walkthrough-samples';

export type { WalkthroughPose } from './walkthrough-samples';
/** Muestreo por distancia, velocidad por tramo y pausas. Nunca corrige paredes a escondidas. */
export function buildWalkthrough(doc: EditorDocument, route: WalkthroughPath) {
  if (route.waypoints.some((point) => point.levelId !== undefined)) return buildBuildingWalkthrough(doc, route);
  const nav = walkthroughNavigation(doc, route.zoneIds), points = route.waypoints;
  if (points.length < 2) throw new Error('Añade al menos dos puntos al recorrido');
  const missing = route.zoneIds.filter((id) => !nav.rooms.some((room) => room.id === id));
  if (missing.length) throw new Error('Una estancia del recorrido ya no existe. Vuelve a preparar la ruta.');
  const positions = points.map((p) => new Vector3(p.x, p.eyeHeightMm, p.y));
  const samples: WalkthroughSample[] = [], invalidSegments: number[] = [];
  const blockedSegments: { index: number; block: WalkBlock }[] = [];
  let time = 0;
  const count = route.loop ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    const before = positions[i ? i - 1 : route.loop ? positions.length - 1 : 0]!;
    const after = positions[(i + 2) < positions.length ? i + 2 : route.loop ? (i + 2) % positions.length : positions.length - 1]!;
    // Catmull-Rom local: los puntos intermedios se comprueban también contra obstáculos.
    const curve = new CatmullRomCurve3([before, positions[i]!, positions[(i + 1) % points.length]!, after], false, 'catmullrom', .25);
    const steps = Math.max(2, Math.ceil(distance(a, b) / 30));
    if (steps > 10000 || samples.length + steps > 30000) throw new Error('Tramo demasiado largo');
    let section = Array.from({ length: steps + 1 }, (_, j) => curve.getPoint((1 + j / steps) / 3));
    const firstBlock = (list: Vector3[]) => {
      for (let j = 0; j < list.length; j++) {
        const p = list[j]!, at = { x: p.x, y: p.z };
        const block = nav.blockAt(at, p.y) || (j ? nav.segmentBlock(
          { x: list[j - 1]!.x, y: list[j - 1]!.z }, at, Math.max(p.y, list[j - 1]!.y)) : null);
        if (block) return block;
      }
      return null;
    };
    if (firstBlock(section)) {
      // Esquinas estrechas: mantener el camino recto validado en vez de cortar por el muro.
      section = Array.from({ length: steps + 1 }, (_, j) => positions[i]!.clone().lerp(positions[(i + 1) % points.length]!, j / steps));
      const block = firstBlock(section);
      if (block) { invalidSegments.push(i); blockedSegments.push({ index: i, block }); }
    }
    for (let j = 0; j < section.length; j++) {
      const p = section[j]!;
      if (j) time += p.distanceTo(section[j - 1]!) / a.speedMmPerS * 1000;
      samples.push({ x: p.x, y: p.z, height: p.y + nav.floorAt({ x: p.x, y: p.z }), time, waypoint: a });
      if (j === 0 && a.dwellMs) { time += a.dwellMs; samples.push({ ...samples.at(-1)!, time }); }
    }
  }
  const last = points.at(-1)!;
  if (!route.loop && last.dwellMs) { time += last.dwellMs; samples.push({ ...samples.at(-1)!, time, waypoint: last }); }
  if (time < 100) throw new Error('Separa los puntos o añade una pausa para reproducir el recorrido.');
  return { ...compileWalkthroughSamples(samples, time, invalidSegments), blockedSegments, absoluteElevation: false as const };
}
