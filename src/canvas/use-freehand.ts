'use client';

/**
 * Dibujo a mano alzada sobre el stage.
 *
 * Acumula puntos mientras el puntero se arrastra y, al soltar, confía el trazo
 * completo al store (una sola entrada en el historial por trazo, no por punto).
 * El trazo en curso vive en estado local para no inundar el store durante el
 * arrastre.
 */
import { useRef, useState, useCallback } from 'react';
import type Konva from 'konva';
import { useCanvasStore } from './canvas-store';
import type { Stroke } from './types';

export interface FreehandOptions {
  color: string;
  width: number;
  enabled: boolean;
}

let strokeSeq = 0;

export function useFreehand({ color, width, enabled }: FreehandOptions) {
  const addStroke = useCanvasStore((s) => s.addStroke);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const drawing = useRef(false);

  const onPointerDown = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      if (!enabled) return;
      const pos = e.target.getStage()?.getPointerPosition();
      if (!pos) return;
      drawing.current = true;
      strokeSeq += 1;
      setDraft({ id: `stroke-${strokeSeq}`, points: [pos.x, pos.y], color, width });
    },
    [enabled, color, width],
  );

  const onPointerMove = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!drawing.current) return;
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    setDraft((prev) => (prev ? { ...prev, points: [...prev.points, pos.x, pos.y] } : prev));
  }, []);

  const onPointerUp = useCallback(() => {
    if (!drawing.current || !draft) return;
    drawing.current = false;
    addStroke(draft);
    setDraft(null);
  }, [draft, addStroke]);

  return { draft, handlers: { onPointerDown, onPointerMove, onPointerUp } };
}
