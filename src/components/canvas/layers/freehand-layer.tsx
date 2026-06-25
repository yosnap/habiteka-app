'use client';

/**
 * Contenido de trazos a mano alzada: los trazos confirmados del documento más el
 * trazo en curso (si lo hay) para feedback inmediato durante el arrastre.
 *
 * Devuelve un `Group` (no un `Layer` propio) para compartir la capa de fondo con
 * la imagen base — ver `BackgroundLayer`.
 */
import { Group, Line } from 'react-konva';
import type { Stroke } from '@/canvas/types';

interface Props {
  strokes: Stroke[];
  draft: Stroke | null;
}

export function FreehandContent({ strokes, draft }: Props) {
  const all = draft ? [...strokes, draft] : strokes;
  return (
    <Group>
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
    </Group>
  );
}
