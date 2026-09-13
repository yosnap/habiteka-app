'use client';
import { Arrow, Group, Line, Rect, Text } from 'react-konva';
import type { DimensionLayout } from '@/canvas/editor-v2/dimension-layout';
import { distance } from '@/lib/editor-document/geometry';

/** Pixel-constant architectural dimension. The label masks the middle of the dimension line. */
export function DimensionMark({ layout, scale, label, onSelect }: {
  layout: DimensionLayout; scale: number; label?: string; onSelect?: () => void;
}) {
  const { from, to, sourceFrom, sourceTo } = layout;
  const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
  const rotation = angle > 90 ? angle - 180 : angle < -90 ? angle + 180 : angle;
  const text = label ?? `${(distance(sourceFrom, sourceTo) / 1000).toFixed(2)} m`;
  const width = Math.max(64, text.length * 8 + 16) / scale;
  return <Group listening={Boolean(onSelect)} onClick={(e) => { e.cancelBubble = true; onSelect?.(); }}
    onTap={(e) => { e.cancelBubble = true; onSelect?.(); }}>
    <Line points={[sourceFrom.x, sourceFrom.y, from.x, from.y]} stroke="#77837e" strokeWidth={1 / scale} listening={false} />
    <Line points={[sourceTo.x, sourceTo.y, to.x, to.y]} stroke="#77837e" strokeWidth={1 / scale} listening={false} />
    <Arrow points={[from.x, from.y, to.x, to.y]} stroke="#343b3a" fill="#343b3a" strokeWidth={1 / scale}
      pointerLength={5 / scale} pointerWidth={5 / scale} pointerAtBeginning pointerAtEnding hitStrokeWidth={18 / scale} />
    <Group x={(from.x + to.x) / 2} y={(from.y + to.y) / 2} rotation={rotation}>
      <Rect x={-width / 2} y={-11 / scale} width={width} height={22 / scale} fill="#fafcfb" />
      <Text x={-width / 2} y={-7 / scale} width={width} align="center" text={text} fontSize={14 / scale} fill="#343b3a" />
    </Group>
  </Group>;
}
