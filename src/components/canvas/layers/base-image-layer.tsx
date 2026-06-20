'use client';

/**
 * Capa base: la imagen de origen aportada por el usuario, escalada para encajar
 * en el stage manteniendo proporción. Es el lienzo sobre el que se dibuja y se
 * sitúan los objetos.
 */
import { useMemo } from 'react';
import { Layer, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import type { BaseImage } from '@/canvas/types';

interface Props {
  baseImage: BaseImage | null;
  stageWidth: number;
  stageHeight: number;
}

export function BaseImageLayer({ baseImage, stageWidth, stageHeight }: Props) {
  const [image] = useImage(baseImage?.url ?? '', 'anonymous');

  const fit = useMemo(() => {
    if (!baseImage) return null;
    const scale = Math.min(stageWidth / baseImage.width, stageHeight / baseImage.height);
    return {
      width: baseImage.width * scale,
      height: baseImage.height * scale,
      x: (stageWidth - baseImage.width * scale) / 2,
      y: (stageHeight - baseImage.height * scale) / 2,
    };
  }, [baseImage, stageWidth, stageHeight]);

  if (!image || !fit) return <Layer />;

  return (
    <Layer listening={false}>
      <KonvaImage image={image} x={fit.x} y={fit.y} width={fit.width} height={fit.height} />
    </Layer>
  );
}
