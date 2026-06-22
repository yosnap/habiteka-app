'use client';

/**
 * Capa de fondo del lienzo: agrupa el contenido estático y sin interacción —la
 * imagen base (o render aplicado) y los trazos a mano alzada— en una sola capa de
 * Konva. Ambos comparten el sistema de coordenadas del documento y no escuchan
 * eventos, así que viven juntos para no superar las 3-5 capas recomendadas por
 * Konva (cada `Layer` es un `<canvas>` propio y de más penaliza el rendimiento).
 */
import { Layer } from 'react-konva';
import type { BaseImage, Stroke } from '@/canvas/types';
import { BaseImageContent } from './base-image-layer';
import { FreehandContent } from './freehand-layer';

interface Props {
  baseImage: BaseImage | null;
  stageWidth: number;
  stageHeight: number;
  strokes: Stroke[];
  draft: Stroke | null;
}

export function BackgroundLayer({ baseImage, stageWidth, stageHeight, strokes, draft }: Props) {
  return (
    <Layer listening={false}>
      <BaseImageContent baseImage={baseImage} stageWidth={stageWidth} stageHeight={stageHeight} />
      <FreehandContent strokes={strokes} draft={draft} />
    </Layer>
  );
}
