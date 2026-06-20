'use client';

/**
 * Capa de trazos a mano alzada. Pinta los trazos confirmados del documento más
 * el trazo en curso (si lo hay) para feedback inmediato durante el arrastre.
 */
import { Layer, Line } from 'react-konva';
import type { Stroke } from '@/canvas/types';

interface Props {
  strokes: Stroke[];
  draft: Stroke | null;
}

export function FreehandLayer({ strokes, draft }: Props) {
  const all = draft ? [...strokes, draft] : strokes;
  return (
    <Layer listening={false}>
      {all.map((s) => (
        <Line
          key={s.id}
          points={s.points}
          stroke={s.color}
          strokeWidth={s.width}
          lineCap="round"
          lineJoin="round"
          tension={0.4}
        />
      ))}
    </Layer>
  );
}
