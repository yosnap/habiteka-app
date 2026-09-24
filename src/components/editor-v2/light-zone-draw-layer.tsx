'use client';
import { Circle, Group, Line } from 'react-konva';
import type { Point } from '@/lib/editor-document/schema';
import type { LightZoneDraft } from '@/canvas/editor-v2/light-zone-draw';

const ZONE_INK = '#7a4fd1';
const flat = (polygon: readonly Point[]) => polygon.flatMap((point) => [point.x, point.y]);

/**
 * Vista del trazo de una zona de luces sobre el plano grande: las partes ya
 * marcadas, la estancia bajo el cursor en modo estancia, el contorno en curso y
 * el rectángulo en arrastre. Es solo pintura; no escucha eventos.
 */
export function LightZoneDrawLayer({ draft, cursor, hovered, rectangle, scale }: {
  draft: LightZoneDraft;
  cursor: Point | null;
  /** Contorno de la estancia bajo el cursor, si el modo estancia la reconoce. */
  hovered: readonly Point[] | null;
  rectangle: { start: Point; end: Point } | null;
  scale: number;
}) {
  return <Group listening={false}>
    {hovered && <Line points={flat(hovered)} closed fill="rgba(122,79,209,.12)"
      stroke={ZONE_INK} strokeWidth={1.5 / scale} dash={[10 / scale, 6 / scale]} />}
    {draft.parts.map((part, index) => <Line key={index} points={flat(part.polygon)} closed
      fill="rgba(122,79,209,.22)" stroke={ZONE_INK} strokeWidth={2.5 / scale} />)}
    {draft.vertices.length > 0 && <>
      <Line points={flat(cursor ? [...draft.vertices, cursor] : draft.vertices)}
        stroke={ZONE_INK} strokeWidth={2 / scale} dash={[10 / scale, 6 / scale]} />
      {draft.vertices.map((vertex, index) => <Circle key={index} x={vertex.x} y={vertex.y}
        radius={(index === 0 ? 7 : 5) / scale} fill={ZONE_INK} stroke="white" strokeWidth={1.5 / scale} />)}
    </>}
    {rectangle && <Line closed stroke={ZONE_INK} strokeWidth={2 / scale} dash={[10 / scale, 6 / scale]}
      fill="rgba(122,79,209,.14)" points={[
        rectangle.start.x, rectangle.start.y, rectangle.end.x, rectangle.start.y,
        rectangle.end.x, rectangle.end.y, rectangle.start.x, rectangle.end.y]} />}
  </Group>;
}

export default LightZoneDrawLayer;
