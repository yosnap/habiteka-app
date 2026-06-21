'use client';

/**
 * Rejilla de fondo del lienzo: líneas cada `GRID` px para dar referencia visual y
 * facilitar la alineación. Es decorativa y no captura eventos (`listening=false`).
 */
import { Layer, Line } from 'react-konva';

export const GRID = 20;

export function GridLayer({ width, height }: { width: number; height: number }) {
  const lines = [];
  for (let x = 0; x <= width; x += GRID) {
    lines.push(<Line key={`v${x}`} points={[x, 0, x, height]} stroke="#ece7e1" strokeWidth={1} />);
  }
  for (let y = 0; y <= height; y += GRID) {
    lines.push(<Line key={`h${y}`} points={[0, y, width, y]} stroke="#ece7e1" strokeWidth={1} />);
  }
  return <Layer listening={false}>{lines}</Layer>;
}

/** Redondea un valor a la rejilla. */
export function snap(value: number): number {
  return Math.round(value / GRID) * GRID;
}
