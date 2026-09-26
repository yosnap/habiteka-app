import { describe, expect, it } from 'vitest';
import { visualSampleDocument } from '@/app/dev/editor-v2/visual-sample';
import { showcaseFrame, SHOWCASE_INTRO_MS } from '@/components/editor-v2/scene/showcase-timeline';
import { MAX_NATIVE_VIDEO_DURATION_MS, nativeVideoDurationIssue, nativeVideoDurationMs } from '@/lib/editor-document/native-video';

describe('guion visual del vídeo', () => {
  it('revela el mismo inmueble por capas con cámaras deterministas', () => {
    const doc = visualSampleDocument();
    expect([0, 1000, 2000, 3000].map((time) => showcaseFrame(doc, time).stage)).toEqual([0, 1, 2, 3]);
    expect(showcaseFrame(doc, 2500)).toEqual(showcaseFrame(doc, 2500));
    const first = showcaseFrame(doc, 0), last = showcaseFrame(doc, SHOWCASE_INTRO_MS - 1);
    expect(first.position).not.toEqual(last.position);
    expect(first.focus).toEqual(last.focus);
  });
  it('suma la introducción solo al vídeo de montaje', () => {
    expect(nativeVideoDurationMs(22000, 'walkthrough')).toBe(22000);
    expect(nativeVideoDurationMs(22000, 'showcase')).toBe(22000 + SHOWCASE_INTRO_MS);
  });
  it('acepta una visita de 93 s y su montaje sin superar el límite compartido', () => {
    expect(nativeVideoDurationIssue(93000, 'walkthrough')).toBeNull();
    expect(nativeVideoDurationIssue(93000, 'showcase')).toBeNull();
    expect(nativeVideoDurationIssue(MAX_NATIVE_VIDEO_DURATION_MS, 'walkthrough')).toBeNull();
    expect(nativeVideoDurationIssue(MAX_NATIVE_VIDEO_DURATION_MS - SHOWCASE_INTRO_MS, 'showcase')).toBeNull();
    expect(nativeVideoDurationIssue(MAX_NATIVE_VIDEO_DURATION_MS + 1, 'walkthrough')).toContain('máximo');
    expect(nativeVideoDurationIssue(MAX_NATIVE_VIDEO_DURATION_MS - SHOWCASE_INTRO_MS + 1, 'showcase')).toContain('máximo');
    expect(nativeVideoDurationIssue(0, 'walkthrough')).toContain('0,1 segundos');
  });
});
