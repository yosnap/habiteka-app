import type { Point } from './schema';
import type { PropertyVisitFrame } from './property-visit-types';
import type { walkthroughNavigation } from './walkthrough-navigation';
import { distance, interpolate } from './geometry';

/** Ruta a altura de ojos. Sus pasos se agrupan después en clips, no se factura cada giro. */
export function propertyVisitFrames(nav: ReturnType<typeof walkthroughNavigation>, levelId: string, start: Point, heading: number) {
  const frames: PropertyVisitFrame[] = [];
  let position = start, yaw = heading;
  const emit = (label: string, seconds: number) => {
    const y = (nav.floorAt(position) + 1600) / 1000;
    const angle = yaw * Math.PI / 180, roomId = nav.roomAt(position)?.id ?? null;
    frames.push({ id: `frame-${frames.length + 1}`, label, roomId, levelId, secondsFromPrevious: seconds,
      camera: { position: [position.x / 1000, y, position.y / 1000],
        focus: [position.x / 1000 + Math.sin(angle), y, position.y / 1000 + Math.cos(angle)], fovDeg: 75,
        levelId: levelId === 'ground' ? null : levelId } });
  };
  const turn = (target: number, label: string) => {
    const delta = (((target - yaw + 180) % 360) + 360) % 360 - 180;
    const steps = Math.ceil(Math.abs(delta) / 60);
    if (!steps) return;
    const original = yaw;
    for (let i = 1; i <= steps; i++) { yaw = original + delta * i / steps; emit(label, Math.abs(delta) / steps / 60); }
    yaw = ((yaw % 360) + 360) % 360;
  };
  emit('Exterior · comienzo del paseo', 0);
  return {
    frames,
    move(path: Point[], label: string) {
      for (const target of path) {
        const length = distance(position, target);
        if (length < 1) continue;
        if (!nav.segmentFree(position, target)) throw new Error('Un tramo del paseo ha dejado de ser transitable.');
        turn(Math.atan2(target.x - position.x, target.y - position.y) * 180 / Math.PI, `${label} · orientar cámara`);
        // Pasos cortos: no pedir al modelo que revele de golpe habitaciones lejanas.
        const origin = position, steps = Math.ceil(length / 2000);
        for (let i = 1; i <= steps; i++) {
          position = interpolate(origin, target, i / steps);
          emit(label, length / steps / 1400);
        }
      }
    },
    inspect(name: string) {
      emit(`${name} · observar la zona`, 1);
    },
  };
}
