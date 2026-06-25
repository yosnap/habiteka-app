'use client';

/**
 * Overlay de cota EN VIVO durante mover/redimensionar un objeto (Tier 1.3, estilo
 * Planner5D). No interactivo. Mismo look que `draw-wall-overlay` (Label+Tag+Text).
 *
 * - kind 'resize' → tamaño del objeto (ancho × fondo) centrado sobre su AABB.
 * - kind 'move'   → distancias a los vecinos más cercanos en cada lado (cotas de hueco).
 *
 * Vive dentro de la capa de objetos (no abre un Layer propio) para no exceder el
 * máximo de capas recomendado por Konva.
 */
import { Group, Line, Label, Tag, Text } from 'react-konva';
import type { WorldRect } from '@/canvas/floating-menu-anchor';
import type { CanvasScale } from '@/canvas/types';
import { isValidScale, formatLength } from '@/canvas/scale';
import { neighborGaps } from '@/canvas/live-dimensions';

/** Gesto en curso: el AABB actual del objeto/selección y qué se está midiendo. */
export interface LiveDimension {
  kind: 'move' | 'resize';
  rect: WorldRect;
  /** AABB de los vecinos (precalculados en onDragStart); solo se usa en 'move'. */
  others: WorldRect[];
  /** Texto ya formateado del tamaño (solo en 'resize'); evita recalcular aquí. */
  sizeLabel?: string;
}

function CotaTag({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <Label x={x} y={y} offsetY={9} listening={false}>
      <Tag fill="#1f1b18" cornerRadius={3} />
      <Text text={text} fontSize={12} fill="#ffffff" padding={4} fontFamily="monospace" />
    </Label>
  );
}

export function LiveDimensionOverlay({
  live,
  scale,
}: {
  live: LiveDimension | null;
  scale: CanvasScale | undefined;
}) {
  if (!live) return null;
  const { rect } = live;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;

  if (live.kind === 'resize') {
    if (!live.sizeLabel) return null;
    return (
      <Group listening={false}>
        <CotaTag x={cx} y={rect.y - 6} text={live.sizeLabel} />
      </Group>
    );
  }

  // kind 'move': cotas de hueco a los vecinos. Requiere escala usable.
  if (!isValidScale(scale)) return null;
  const gaps = neighborGaps(rect, live.others, scale);
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  return (
    <Group listening={false}>
      {gaps.left !== undefined ? (
        <>
          <Line points={[rect.x - gaps.left * scale.pxPerMeter, cy, rect.x, cy]} stroke="#b5532f" strokeWidth={1} dash={[4, 3]} />
          <CotaTag x={rect.x - (gaps.left * scale.pxPerMeter) / 2} y={cy} text={formatLength(gaps.left)} />
        </>
      ) : null}
      {gaps.right !== undefined ? (
        <>
          <Line points={[right, cy, right + gaps.right * scale.pxPerMeter, cy]} stroke="#b5532f" strokeWidth={1} dash={[4, 3]} />
          <CotaTag x={right + (gaps.right * scale.pxPerMeter) / 2} y={cy} text={formatLength(gaps.right)} />
        </>
      ) : null}
      {gaps.top !== undefined ? (
        <>
          <Line points={[cx, rect.y - gaps.top * scale.pxPerMeter, cx, rect.y]} stroke="#b5532f" strokeWidth={1} dash={[4, 3]} />
          <CotaTag x={cx} y={rect.y - (gaps.top * scale.pxPerMeter) / 2} text={formatLength(gaps.top)} />
        </>
      ) : null}
      {gaps.bottom !== undefined ? (
        <>
          <Line points={[cx, bottom, cx, bottom + gaps.bottom * scale.pxPerMeter]} stroke="#b5532f" strokeWidth={1} dash={[4, 3]} />
          <CotaTag x={cx} y={bottom + (gaps.bottom * scale.pxPerMeter) / 2} text={formatLength(gaps.bottom)} />
        </>
      ) : null}
    </Group>
  );
}
