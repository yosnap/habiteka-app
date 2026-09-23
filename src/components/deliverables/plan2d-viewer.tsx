'use client';

/**
 * Visor del plano 2D: dibuja el plano estructurado en un lienzo de solo lectura y
 * estampa el sello legal DENTRO del stage, de modo que sobrevive a la exportación
 * (`toDataURL`/PDF) — un sello solo en el DOM no aparecería en el export.
 */
import { useRef } from 'react';
import type Konva from 'konva';
import { Stage, Layer, Line, Rect, Text } from 'react-konva';
import { drawableZones, planToPrimitives } from './plan2d-to-konva';
import { DELIVERABLE_LEGAL_SEAL } from '@/lib/legal-text';
import { Button } from '@/components/ui/button';
import type { Plano2dPayload } from '@/lib/contracts';

interface Props {
  plano: Plano2dPayload;
  width?: number;
  height?: number;
  /** Muestra el botón para descargar el plano como PNG (con el sello incluido). */
  downloadable?: boolean;
}

const WALL = '#3a322d';
const BACKGROUND = '#faf8f5';
const WINDOW = '#4a90c2';
const DOOR = '#b0762f';

export function Plan2dViewer({ plano, width = 640, height = 420, downloadable = false }: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const primitives = planToPrimitives(plano, { width: width - 24, height: height - 48 });
  if (drawableZones(plano).length === 0) {
    return <p role="status" className="bg-surface rounded-card p-4 text-sm">Este plano se generó sin geometría dibujable. Vuelve a generarlo desde el estudio.</p>;
  }

  const download = () => {
    const url = stageRef.current?.toDataURL({ pixelRatio: 2 });
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = 'habiteka-plano.png';
    link.click();
  };

  return (
    <div className="flex flex-col gap-2">
      {plano.aproximado ? (
        <p role="note" className="rounded-control border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          Plano orientativo: no se pudo leer una planta nítida en tu imagen, así que es una
          aproximación. Para un plano fiel, sube un plano en planta nítido o dibújalo en el editor.
        </p>
      ) : null}
      <div className="max-w-full overflow-x-auto">
        <Stage ref={stageRef} width={width} height={height} className="rounded-card">
          <Layer listening={false}>
            {/* Fondo opaco: el PNG exportado no sale transparente. */}
            <Rect x={0} y={0} width={width} height={height} fill={BACKGROUND} />
          </Layer>
          <Layer listening={false} x={12} y={12}>
            {primitives.walls.map((w, i) => (
              <Line key={`w${i}`} points={w.points} stroke={WALL} strokeWidth={w.strokeWidth} lineCap="round" />
            ))}
            {primitives.apertures.map((a, i) => (
              <Line
                key={`a${i}`}
                points={a.points}
                stroke={a.kind === 'ventana' ? WINDOW : a.kind === 'puerta' ? DOOR : BACKGROUND}
                strokeWidth={a.strokeWidth}
              />
            ))}
            {primitives.labels.map((l, i) => (
              <Text key={`l${i}`} text={l.text} x={l.x - 60} y={l.y - 7} width={120} align="center" fontSize={12} fill={WALL} fontFamily="sans-serif" />
            ))}
          </Layer>
          {/* Capa de sello: parte del lienzo, por lo que entra en cualquier export. */}
          <Layer listening={false}>
            <Text text={DELIVERABLE_LEGAL_SEAL} x={8} y={height - 18} fontSize={11} fill="#6b625c" fontFamily="sans-serif" />
          </Layer>
        </Stage>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-soft">
        <span className="flex items-center gap-1"><span className="inline-block h-1 w-4" style={{ background: DOOR }} /> Puerta</span>
        <span className="flex items-center gap-1"><span className="inline-block h-1 w-4" style={{ background: WINDOW }} /> Ventana</span>
        {downloadable ? (
          <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={download}>
            Descargar PNG
          </Button>
        ) : null}
      </div>
    </div>
  );
}
