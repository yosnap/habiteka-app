'use client';

/**
 * Contenido de la imagen base: la imagen de origen (o el render aplicado),
 * escalada para encajar en el stage manteniendo proporción. Es el lienzo sobre el
 * que se dibuja y se sitúan los objetos.
 *
 * Devuelve un `Group` (no un `Layer` propio) para poder compartir una única capa
 * de fondo con los trazos: Konva recomienda 3-5 capas por stage, así que el
 * contenido estático y sin interacción se agrupa en `BackgroundLayer`.
 */
import { useMemo } from 'react';
import { Group, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import type { BaseImage } from '@/canvas/types';

interface Props {
  baseImage: BaseImage | null;
  stageWidth: number;
  stageHeight: number;
}

export function BaseImageContent({ baseImage, stageWidth, stageHeight }: Props) {
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

  if (!image || !fit || !baseImage) return null;

  return (
    <Group>
      <KonvaImage
        image={image}
        x={fit.x}
        y={fit.y}
        width={fit.width}
        height={fit.height}
        opacity={baseImage.opacity ?? 1}
      />
    </Group>
  );
}
