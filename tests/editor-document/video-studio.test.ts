import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { videoStudioReadiness } from '@/lib/editor-document/video-studio';
import { nativeVideoDurationIssue, nativeVideoDurationMs } from '@/lib/editor-document/native-video';
import { constructionAudioSamples } from '@/components/editor-v2/scene/construction-audio';
import { requestedRenderRedesign } from '@/lib/editor-document/render-redesign';

describe('preparación del estudio', () => {
  const document = { ...emptyEditorDocument(), vertices: [{ id: 'a', x: 0, y: 0 }] };
  it('permite construcción sola sin ruta, pero bloquea visita y muestra sin ella', () => {
    expect(videoStudioReadiness(document, 'construction', null)).toEqual({ issue: null, durationMs: 8000 });
    expect(videoStudioReadiness(document, 'construction', null, { constructionDurationSeconds: 12 }).durationMs).toBe(12000);
    expect(videoStudioReadiness(document, 'walkthrough', null).issue).toContain('recorrido');
    expect(videoStudioReadiness(document, 'showcase', null).issue).toContain('recorrido');
  });
  it('mantiene el requisito de parcela solo para publicidad geográfica', () => {
    expect(videoStudioReadiness(document, 'promotion', null).issue).toBeTruthy();
    expect(videoStudioReadiness(document, 'construction', null).issue).toBeNull();
    expect(videoStudioReadiness(emptyEditorDocument(), 'construction', null).issue).toContain('Dibuja');
  });
  it('no suma una ruta ajena a la construcción ni aplica el límite de visita a obra sola', () => {
    expect(nativeVideoDurationMs(100000, 'construction')).toBe(8000);
    expect(nativeVideoDurationIssue(0, 'construction')).toBeNull();
    expect(nativeVideoDurationIssue(100000, 'showcase')).toBeNull();
    expect(nativeVideoDurationIssue(100000, 'showcase', { constructionDurationSeconds: 12 })).toContain('máximo');
  });
  it('estira los efectos con las etapas de una construcción de 30 s', () => {
    const samples = constructionAudioSamples(30, false, 1, 1000, 30 / 16);
    expect(samples.slice(0, 3750).every(sample => sample === 0)).toBe(true);
    expect(samples.slice(17000, 20000).some(sample => sample !== 0)).toBe(true);
    expect(samples.slice(21200).every(sample => sample === 0)).toBe(true);
  });
  it('distingue la petición de rediseño del permiso de sustituir fijos', () => {
    expect(requestedRenderRedesign({ redesignFixed: false }, 'Rediseñar el dormitorio', '')).toBe(true);
    expect(requestedRenderRedesign({ redesignFixed: true }, '', '')).toBe(true);
    expect(requestedRenderRedesign({ redesignFixed: false }, 'Más luz', '')).toBe(false);
  });
});
