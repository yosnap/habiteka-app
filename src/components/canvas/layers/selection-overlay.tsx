'use client';

/**
 * Overlay de la marquesina de selección de zona (fase de ajuste). Dibuja el
 * rectángulo en curso mientras el usuario arrastra; al soltar, el workspace lo
 * convierte en una zona normalizada (contrato `CanvasZone`).
 *
 * Devuelve un `Group` (no un `Layer` propio): va dentro de la capa de overlays
 * compartida con el dibujo de muro, para no exceder el máximo de capas de Konva.
 */
import { Group, Rect } from 'react-konva';

export interface MarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function SelectionOverlay({ marquee }: { marquee: MarqueeRect | null }) {
  if (!marquee) return null;
  return (
    <Group listening={false}>
      <Rect
        x={marquee.x}
        y={marquee.y}
        width={marquee.width}
        height={marquee.height}
        stroke="#b5532f"
        strokeWidth={2}
        dash={[6, 4]}
        fill="rgba(181, 83, 47, 0.08)"
      />
    </Group>
  );
}
