'use client';

/**
 * Rejilla de fondo del lienzo: líneas cada `GRID` px de mundo. Se extiende para
 * cubrir el área visible actual según el zoom (`scale`) y el desplazamiento
 * (`offsetX/offsetY`), de modo que la rejilla rellena toda la pantalla aunque se
 * haga pan o zoom. Es decorativa y no captura eventos.
 */
import { Layer, Line } from 'react-konva';

export const GRID = 20;

interface Props {
  width: number;
  height: number;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}

export function GridLayer({ width, height, scale = 1, offsetX = 0, offsetY = 0 }: Props) {
  // Rango de mundo visible: se invierte la transformación del stage (x = world*scale + offset).
  const worldLeft = -offsetX / scale;
  const worldTop = -offsetY / scale;
  const worldRight = (width - offsetX) / scale;
  const worldBottom = (height - offsetY) / scale;

  const startX = Math.floor(worldLeft / GRID) * GRID;
  const startY = Math.floor(worldTop / GRID) * GRID;

  const lines = [];
  for (let x = startX; x <= worldRight; x += GRID) {
    lines.push(
      <Line
        key={`v${x}`}
        points={[x, worldTop, x, worldBottom]}
        stroke="#ece7e1"
        strokeWidth={1 / scale}
      />,
    );
  }
  for (let y = startY; y <= worldBottom; y += GRID) {
    lines.push(
      <Line
        key={`h${y}`}
        points={[worldLeft, y, worldRight, y]}
        stroke="#ece7e1"
        strokeWidth={1 / scale}
      />,
    );
  }
  return <Layer listening={false}>{lines}</Layer>;
}

/** Redondea un valor a la rejilla. */
export function snap(value: number): number {
  return Math.round(value / GRID) * GRID;
}
