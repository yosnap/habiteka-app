'use client';

/**
 * Visor del plano 2D: dibuja el plano estructurado en un lienzo de solo lectura y
 * estampa el sello legal DENTRO del stage, de modo que sobrevive a la exportación
 * (`toDataURL`/PDF) — un sello solo en el DOM no aparecería en el export.
 */
import { Stage, Layer, Line, Text } from 'react-konva';
import { drawableZones, planToPrimitives } from './plan2d-to-konva';
import { DELIVERABLE_LEGAL_SEAL } from '@/lib/legal-text';
import type { Plano2dPayload } from '@/lib/contracts';

interface Props {
  plano: Plano2dPayload;
  width?: number;
  height?: number;
}

export function Plan2dViewer({ plano, width = 640, height = 420 }: Props) {
  const primitives = planToPrimitives(plano, { width, height: height - 24 });
  if (drawableZones(plano).length === 0) {
    return <p role="status" className="bg-surface rounded-card p-4 text-sm">Este plano se generó sin geometría dibujable. Vuelve a generarlo desde el estudio.</p>;
  }

  return (
    <Stage width={width} height={height} className="bg-surface rounded-card">
      <Layer listening={false}>
        {primitives.walls.map((w, i) => (
          <Line
            key={i}
            points={w.points}
            stroke="#3a322d"
            strokeWidth={w.strokeWidth}
            lineCap="round"
          />
        ))}
      </Layer>
      {/* Capa de sello: parte del lienzo, por lo que entra en cualquier export. */}
      <Layer listening={false}>
        <Text
          text={DELIVERABLE_LEGAL_SEAL}
          x={8}
          y={height - 18}
          fontSize={11}
          fill="#6b625c"
          fontFamily="sans-serif"
        />
      </Layer>
    </Stage>
  );
}
