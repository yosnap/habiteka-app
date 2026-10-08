import { describe, expect, it } from 'vitest';
import { compactPropertyVisit } from '@/lib/editor-document/property-visit-compact';
import { propertyVisitSequence, propertyVisitSegmentPrompt, PROPERTY_VISIT_COMPACT_MODEL, type PropertyVisitJob } from '@/lib/editor-document/property-visit-job';
import { visitFixture } from '../fixtures/property-visit-job';

describe('paseo de un minuto separado de construcción', () => {
  it('agrupa todos los pasos, conserva curvas y cubre la última zona sin truncar la ruta', () => {
    const job = visitFixture();
    job.plan.frames = Array.from({ length: 101 }, (_, index) => ({ ...job.plan.frames[0]!, id: `f${index}`, roomId: `room${Math.floor(index / 7)}`,
      secondsFromPrevious: index ? 2 : 0,
      camera: { ...job.plan.frames[0]!.camera, position: [index / 10, 1.6, index % 2] as [number, number, number] } }));
    const plan = compactPropertyVisit(job.plan), sequence = propertyVisitSequence(plan);
    expect(plan.durationSeconds).toBe(60); expect(plan.frames).toHaveLength(11); expect(sequence.images).toHaveLength(11);
    const paths = sequence.segments.flatMap((segment, index) => index ? segment.route!.slice(1) : segment.route!);
    expect(paths).toEqual(job.plan.frames);
    expect(new Set(paths.map(frame => frame.roomId))).toEqual(new Set(job.plan.frames.map(frame => frame.roomId)));
    expect(sequence.segments.at(-1)?.route?.at(-1)?.id).toBe('f100');
    const compactJob: PropertyVisitJob = { ...job, plan, ...sequence, videoModel: PROPERTY_VISIT_COMPACT_MODEL };
    for (const segment of sequence.segments) expect(propertyVisitSegmentPrompt(compactJob, segment).length).toBeLessThanOrEqual(1500);
  });
  it('no convierte una ruta inaccesible en completa ni exige diez clips a una casa pequeña', () => {
    const job = visitFixture(); job.plan.complete = false;
    expect(compactPropertyVisit(job.plan)).toEqual(job.plan);
    job.plan.complete = true;
    expect(compactPropertyVisit(job.plan).durationSeconds).toBe(12);
  });
});
