import { containVideoRect } from '@/lib/editor-document/video-format';
import type { AdvertisingVideoOptions } from '@/lib/editor-document/advertising-video';
import type { VideoMeasurements } from '@/lib/editor-document/video-measurements';
import { dimensionReveal } from '@/lib/editor-document/video-presentation';

/** Panel fijo en pantalla: no pretende seguir la cámara ni medir la geometría del clip IA. */
export function advertisingFrame(context: CanvasRenderingContext2D, width: number, height: number,
  sourceWidth: number, sourceHeight: number, elapsedMs: number, options: AdvertisingVideoOptions,
  measurements: VideoMeasurements | null, draw: (rect: ReturnType<typeof containVideoRect>) => void) {
  const withMeasures = options.dimensionMode !== 'none' && measurements;
  const vertical = height > width, panelHeight = withMeasures ? (vertical ? 320 : 180) : 0;
  context.fillStyle = '#10241d'; context.fillRect(0, 0, width, height);
  const rect = containVideoRect(sourceWidth, sourceHeight, width, height - panelHeight);
  draw(rect);
  if (!withMeasures) return;
  const top = height - panelHeight, margin = width * .06;
  const titleOpacity = dimensionReveal(options.dimensionMode, elapsedMs, 0).opacity;
  context.save(); context.globalAlpha = titleOpacity;
  context.fillStyle = '#d8e8df'; context.font = `${vertical ? 28 : 23}px sans-serif`;
  context.fillText('Medidas globales del diseño aprobado', margin, top + 48);
  context.restore();
  const values = [['Ancho', measurements.widthM], ['Fondo', measurements.depthM], ['Altura', measurements.heightM]] as const;
  const columnWidth = (width - margin * 2) / 3;
  values.forEach(([label, value], index) => {
    const { progress, opacity } = dimensionReveal(options.dimensionMode, elapsedMs, index);
    context.save(); context.globalAlpha = opacity;
    const left = margin + columnWidth * index, lineWidth = columnWidth * .78;
    context.fillStyle = '#5de4ac'; context.fillRect(left, top + 66, lineWidth * progress, 3);
    if (progress === 1) {
      context.fillStyle = '#ffffff'; context.font = `${vertical ? 35 : 30}px sans-serif`;
      context.fillText(`${value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`, left, top + 115);
      context.fillStyle = '#a8c5b6'; context.font = '23px sans-serif'; context.fillText(label, left, top + 146);
    }
    context.restore();
  });
}
