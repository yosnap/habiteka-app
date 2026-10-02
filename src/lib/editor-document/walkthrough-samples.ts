import type { WalkthroughWaypoint } from './walkthrough';

export interface WalkthroughPose { position: [number, number, number]; focus: [number, number, number] }
export interface WalkthroughSample { x: number; y: number; height: number; time: number; waypoint: WalkthroughWaypoint }

/** Misma interpolación de cámara para rutas de una planta o de todo el edificio. */
export function compileWalkthroughSamples(samples: WalkthroughSample[], durationMs: number, invalidSegments: number[]) {
  const samplePose = (elapsedMs: number): WalkthroughPose => {
    const t = Math.max(0, Math.min(durationMs, elapsedMs));
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
  return { durationMs, invalidSegments, samples, samplePose };
}
