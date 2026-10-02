/**
 * Conjunto de fotogramas clave para un vídeo con IA: la evidencia que se manda a Jev es medible y acotada, y el punto
 * de control está registrado con las preguntas que deciden si se anima, se revisa o se regenera.
 */
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { buildKeyframeSetEvidence } from '@/server/quality/evidence/keyframe-set-evidence';
import { VIDEO_KEYFRAMES, VIDEO_KEYFRAMES_CHECKPOINT } from '@/server/quality/checkpoints-video';
import { checkpointIds, getCheckpoint } from '@/server/quality/checkpoints';
import type { TourImage } from '@/lib/editor-document/image-tour';

const image = (id: string, ambient: string, extra: Partial<TourImage> = {}): TourImage =>
  ({ id, ambient, view: 'top', lighting: 'daylight', freedom: 'strict', revision: 143, createdAt: '2026-09-30T02:00:00Z', url: `https://x/${id}.png`, ...extra });

describe('puntos de control del vídeo con IA', () => {
  it('está registrado con sus preguntas', () => {
    expect(checkpointIds()).toContain(VIDEO_KEYFRAMES_CHECKPOINT);
    expect(getCheckpoint(VIDEO_KEYFRAMES_CHECKPOINT)).toBe(VIDEO_KEYFRAMES);
    expect(Object.keys(VIDEO_KEYFRAMES.questions)).toEqual(['same_design', 'same_light', 'same_fidelity', 'coverage', 'verdict']);
  });

  it('un conjunto homogéneo no arrastra incidencias automáticas', () => {
    const evidence = buildKeyframeSetEvidence([image('a', 'Cocina'), image('b', 'Salón')], new Set([143]), []);
    expect(evidence).toMatchObject({ imageCount: 2, fromApprovedDesign: 2, lightings: ['daylight'], freedoms: ['strict'], missingAmbients: [], automaticIssues: [] });
    expect(evidence.ambients).toEqual([{ name: 'Cocina', views: ['top'] }, { name: 'Salón', views: ['top'] }]);
  });

  it('un conjunto mezclado lo refleja en la evidencia y en los motivos explicados', () => {
    const evidence = buildKeyframeSetEvidence(
      [image('a', 'Cocina'), image('b', 'Salón', { revision: 120, lighting: 'evening', freedom: 'free' })], new Set([143]), ['Entrada']);
    expect(evidence.fromApprovedDesign).toBe(1);
    expect(evidence.lightings).toEqual(['daylight', 'evening']);
    expect(evidence.freedoms).toEqual(['free', 'strict']);
    expect(evidence.missingAmbients).toEqual(['Entrada']);
    expect(evidence.automaticIssues).toHaveLength(4);
    expect(VIDEO_KEYFRAMES.explain!(evidence)).toEqual(evidence.automaticIssues);
  });

  it('acota la evidencia a 24 imágenes y no incluye direcciones ni archivos', () => {
    const many = Array.from({ length: 40 }, (_, i) => image(`i${i}`, `Ámbito ${i}`));
    const evidence = buildKeyframeSetEvidence(many, new Set([143]), []);
    expect(evidence.imageCount).toBe(24);
    expect(JSON.stringify(evidence)).not.toContain('https://');
    expect(VIDEO_KEYFRAMES.buildState(evidence)).toBe(JSON.stringify(evidence));
  });
});
