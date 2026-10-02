import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { advertisingVideoSchema } from '@/lib/editor-document/advertising-video';
import { containVideoRect, videoFormatSize } from '@/lib/editor-document/video-format';
import { videoMeasurements } from '@/lib/editor-document/video-measurements';
import { DEFAULT_VIDEO_PRESENTATION, videoPresentationSchema } from '@/lib/editor-document/video-presentation';
import { advertisingFrame } from '@/components/deliverables/advertising-frame';
import { addBuildingLevel } from '@/lib/editor-document/building-levels';
import { setExteriorRoof } from '@/lib/editor-document/exterior-roof';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';

describe('publicidad vertical y medidas', () => {
  it('encaja el fotograma completo sin distorsión en ambos formatos', () => {
    expect(videoFormatSize()).toEqual({ width: 1920, height: 1080 });
    expect(videoFormatSize('vertical')).toEqual({ width: 1080, height: 1920 });
    const rect = containVideoRect(1920, 1080, 1080, 1600);
    expect(rect).toEqual({ x: 0, y: 496.25, width: 1080, height: 607.5 });
    expect(rect.width / rect.height).toBeCloseTo(16 / 9);
    expect(containVideoRect(1080, 1920, 1920, 900)).toEqual({ x: 706.875, y: 0, width: 506.25, height: 900 });
    expect(() => containVideoRect(0, 1080, 1080, 1920)).toThrow();
  });
  it('acepta formatos nuevos y mantiene la presentación antigua sin formato', () => {
    expect(videoPresentationSchema.parse(DEFAULT_VIDEO_PRESENTATION).format).toBeUndefined();
    expect(videoPresentationSchema.parse({ ...DEFAULT_VIDEO_PRESENTATION, format: 'vertical' }).format).toBe('vertical');
    expect(advertisingVideoSchema.safeParse({ format: 'vertical', dimensionMode: 'start' }).success).toBe(true);
    for (const options of [{ format: 'square', dimensionMode: 'fixed' }, { format: 'vertical', dimensionMode: 'tracking' },
      { format: 'vertical', dimensionMode: 'fixed', widthM: 999 }]) expect(advertisingVideoSchema.safeParse(options).success).toBe(false);
  });
  it('mide el diseño en metros e incluye la altura de muros y cubierta', () => {
    expect(videoMeasurements(emptyEditorDocument())).toBeNull();
    const doc = upgradeSpatialDocument(addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 5000 }, { x: 0, y: 5000 }], true));
    expect(videoMeasurements(doc)).toEqual({ widthM: 4, depthM: 5, heightM: 2.7 });
    doc.walls[0]!.heightMm = 3500;
    expect(videoMeasurements(doc)?.heightM).toBe(3.5);
    const stacked = addBuildingLevel(doc, true);
    expect(videoMeasurements(stacked)?.heightM).toBe(7);
    const covered = setExteriorRoof(stacked, { kind: 'gable', pitchDeg: 25 });
    expect(videoMeasurements(covered)?.heightM).toBeGreaterThan(7);
  });
  it('reserva un panel separado y retira sus cifras después de cuatro segundos', () => {
    const texts: string[] = [], opacities: number[] = [];
    const context = { globalAlpha: 1, fillStyle: '', font: '', fillRect: () => {}, save: () => {}, restore: () => {},
      fillText(this: { globalAlpha: number }, text: string) { texts.push(text); opacities.push(this.globalAlpha); } } as unknown as CanvasRenderingContext2D;
    let rect: ReturnType<typeof containVideoRect> | undefined;
    advertisingFrame(context, 1080, 1920, 1920, 1080, 1000, { format: 'vertical', dimensionMode: 'start' },
      { widthM: 4, depthM: 5, heightM: 2.7 }, value => { rect = value; });
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(1600);
    expect(texts).toContain('4,00 m'); expect(texts).toContain('Medidas globales del diseño aprobado');
    opacities.length = 0;
    advertisingFrame(context, 1080, 1920, 1920, 1080, 4000, { format: 'vertical', dimensionMode: 'start' },
      { widthM: 4, depthM: 5, heightM: 2.7 }, () => {});
    expect(opacities.every(value => value === 0)).toBe(true);
  });
});
