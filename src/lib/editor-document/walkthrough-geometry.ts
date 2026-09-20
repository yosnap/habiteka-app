import { CatmullRomCurve3, Vector3 } from 'three';
import type { EditorDocument } from './schema';
import type { WalkthroughPath, WalkthroughWaypoint } from './walkthrough';
import { walkthroughNavigation } from './walkthrough-navigation';
import { distance } from './geometry';

export interface WalkthroughPose { position: [number, number, number]; focus: [number, number, number] }
interface Sample { x: number; y: number; height: number; time: number; waypoint: WalkthroughWaypoint }
/** Muestreo por distancia, velocidad por tramo y pausas. Nunca corrige paredes a escondidas. */
export function buildWalkthrough(doc: EditorDocument, route: WalkthroughPath) {
  const nav = walkthroughNavigation(doc, route.zoneIds), points = route.waypoints;
  if (points.length < 2) throw new Error('Añade al menos dos puntos al recorrido');
  const missing = route.zoneIds.filter((id) => !nav.rooms.some((room) => room.id === id));
  if (missing.length) throw new Error('Una estancia del recorrido ya no existe. Vuelve a preparar la ruta.');
  const positions = points.map((p) => new Vector3(p.x, p.eyeHeightMm, p.y));
  const samples: Sample[] = [], invalidSegments: number[] = [];
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
    const safe = (list: Vector3[]) => list.every((p, j) => nav.free({ x: p.x, y: p.z }, p.y) && (!j ||
      nav.segmentFree({ x: list[j - 1]!.x, y: list[j - 1]!.z }, { x: p.x, y: p.z }, Math.max(p.y, list[j - 1]!.y))));
    if (!safe(section)) {
      // Esquinas estrechas: mantener el camino recto validado en vez de cortar por el muro.
      section = Array.from({ length: steps + 1 }, (_, j) => positions[i]!.clone().lerp(positions[(i + 1) % points.length]!, j / steps));
      if (!safe(section)) invalidSegments.push(i);
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
  const samplePose = (elapsedMs: number): WalkthroughPose => {
    const t = Math.max(0, Math.min(time, elapsedMs));
    let lo = 0, hi = samples.length - 1;
    while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (samples[mid]!.time < t) lo = mid + 1; else hi = mid; }
    const b = samples[lo]!, a = samples[Math.max(0, lo - 1)]!;
    const blend = b.time === a.time ? 0 : (t - a.time) / (b.time - a.time);
    const x = a.x + (b.x - a.x) * blend, y = a.y + (b.y - a.y) * blend, h = a.height + (b.height - a.height) * blend;
    const ahead = samples[Math.min(samples.length - 1, lo + 12)]!;
    const back = samples[Math.max(0, lo - 12)]!;
    const yaw = a.waypoint.yawDeg !== undefined ? a.waypoint.yawDeg * Math.PI / 180 : Math.atan2(ahead.x - back.x, ahead.y - back.y);
    const pitch = (a.waypoint.pitchDeg ?? -8) * Math.PI / 180;
    return { position: [x / 1000, h / 1000, y / 1000], focus: a.waypoint.lookAt
      ? [a.waypoint.lookAt.x / 1000, h / 1000, a.waypoint.lookAt.y / 1000]
      : [x / 1000 + Math.sin(yaw) * Math.cos(pitch), h / 1000 + Math.sin(pitch), y / 1000 + Math.cos(yaw) * Math.cos(pitch)] };
  };
  return { durationMs: time, invalidSegments, samples, samplePose };
}
