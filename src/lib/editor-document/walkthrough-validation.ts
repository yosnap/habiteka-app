import { storyboardImageSchema } from '@/lib/contracts/storyboard-image';

/** Sin geometría: una ruta antigua puede quedar inválida y debe poder corregirse. */
export function assertWalkthroughFields(doc: Record<string, unknown>, ids: Set<string>): void {
  const fail = (): never => { throw new Error('Recorrido inválido: revisa puntos, alturas y tiempos'); };
  const object = (raw: unknown, fields: string): Record<string, unknown> => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail();
    const value = raw as Record<string, unknown>;
    if (Object.keys(value).some((key) => !fields.split(' ').includes(key))) fail();
    return value;
  };
  const number = (raw: unknown, min: number, max: number) => {
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < min || raw > max) fail();
  };
  const id = (raw: unknown) => {
    if (typeof raw !== 'string' || !raw.trim() || raw.length > 200 || ids.has(raw)) fail();
    ids.add(raw as string);
  };
  if (!Array.isArray(doc.walkthroughs) || doc.walkthroughs.length > 20) fail();
  for (const raw of doc.walkthroughs as unknown[]) {
    const path = object(raw, 'id name zoneIds waypoints loop storyboardWaypointIds storyboardImages'); id(path.id);
    if (typeof path.name !== 'string' || !path.name.trim() || path.name.length > 80 || typeof path.loop !== 'boolean') fail();
    if (!Array.isArray(path.zoneIds) || path.zoneIds.length > 100 || path.zoneIds.some((v) => typeof v !== 'string' || v.length > 10000)) fail();
    if (!Array.isArray(path.waypoints) || path.waypoints.length > 400) fail();
    for (const rawPoint of path.waypoints as unknown[]) {
      const point = object(rawPoint, 'id x y eyeHeightMm yawDeg pitchDeg lookAt dwellMs speedMmPerS'); id(point.id);
      number(point.x, -1e8, 1e8); number(point.y, -1e8, 1e8);
      number(point.eyeHeightMm, 900, 2200); number(point.dwellMs, 0, 10000); number(point.speedMmPerS, 200, 3000);
      if (point.yawDeg !== undefined) number(point.yawDeg, -360, 360);
      if (point.pitchDeg !== undefined) number(point.pitchDeg, -80, 80);
      if (point.lookAt !== undefined) {
        const focus = object(point.lookAt, 'x y'); number(focus.x, -1e8, 1e8); number(focus.y, -1e8, 1e8);
      }
    }
    if (path.storyboardImages !== undefined) {
      if (!Array.isArray(path.storyboardImages) || path.storyboardImages.length > 400) fail();
      const references = new Set<string>();
      for (const rawImage of path.storyboardImages as unknown[]) {
        const result = storyboardImageSchema.safeParse(rawImage);
        if (!result.success) fail();
        const image = result.data!;
        if (references.has(image.waypointId) || !Array.isArray(path.storyboardWaypointIds) ||
          !path.storyboardWaypointIds.includes(image.waypointId)) fail();
        references.add(image.waypointId);
      }
    }
    if (path.storyboardWaypointIds !== undefined) {
      const points = new Set((path.waypoints as Array<{ id: string }>).map((point) => point.id));
      const frames = path.storyboardWaypointIds;
      if (!Array.isArray(frames) || frames.length > 400 || new Set(frames).size !== frames.length ||
        frames.some((ref) => typeof ref !== 'string' || !points.has(ref))) fail();
    }
  }
}
