'use client';

/**
 * Overlay del muro en curso al dibujar (F7.2): la línea del segmento + su LONGITUD REAL en
 * vivo (cota), como en Planner5D. La cota se calcula con `scale.ts` (px→m) y se muestra junto
 * al punto medio del segmento. Capa no interactiva (no captura eventos).
 */
import { Layer, Line, Label, Tag, Text } from 'react-konva';
import type { DrawWallPreview } from '@/canvas/use-draw-wall';
import { isValidScale, pxToMeters, formatLength } from '@/canvas/scale';
import type { CanvasScale } from '@/canvas/types';

export function DrawWallOverlay({
  preview,
  scale,
}: {
  preview: DrawWallPreview | null;
  scale: CanvasScale | undefined;
}) {
  if (!preview) return <Layer listening={false} />;
  const { start, end } = preview;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthPx = Math.hypot(dx, dy);

  // Cota: longitud real si hay escala usable; si no, en píxeles.
  const cota = isValidScale(scale)
    ? formatLength(pxToMeters(lengthPx, scale))
    : `${Math.round(lengthPx)} px`;

  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  return (
    <Layer listening={false}>
      <Line points={[start.x, start.y, end.x, end.y]} stroke="#b5532f" strokeWidth={2} dash={[6, 4]} />
      {lengthPx > 1 ? (
        <Label x={midX} y={midY} offsetY={18}>
          <Tag fill="#1f1b18" cornerRadius={3} />
          <Text text={cota} fontSize={12} fill="#ffffff" padding={4} fontFamily="monospace" />
        </Label>
      ) : null}
    </Layer>
  );
}
