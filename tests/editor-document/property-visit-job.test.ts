import { describe, expect, it } from 'vitest';
import { visitFixture } from '../fixtures/property-visit-job';
import { propertyVisitSequence, propertyVisitQuote, propertyVisitSegmentPrompt } from '@/lib/editor-document/property-visit-job';
describe('secuencia del paseo completo', () => {
  it('reutiliza cámaras en pausas y comparte literalmente la imagen de cada unión', () => {
    const job = visitFixture();
    expect(job.images).toHaveLength(2); expect(job.segments).toHaveLength(2);
    expect(job.segments[0]!.to).toBe(job.segments[1]!.from);
    expect(job.segments[1]!.from).toBe(job.segments[1]!.to);
    expect(propertyVisitQuote(job)).toEqual({ images: 2, imageUsd: .16, videoUsd: .32 });
    job.images[0]!.state = 'unknown'; job.segments[0]!.state = 'generating';
    expect(propertyVisitQuote(job)).toEqual({ images: 1, imageUsd: .08, videoUsd: .16 });
  });
  it('no crea una producción parcial ni tramos fuera del contrato', () => {
    const job = visitFixture(); job.plan.complete = false;
    expect(() => propertyVisitSequence(job.plan)).toThrow('todo el inmueble');
    job.plan.complete = true; job.plan.frames[1]!.secondsFromPrevious = 16;
    expect(() => propertyVisitSequence(job.plan)).toThrow('duración');
  });
  it('guía solo movimiento y exige conservar la identidad de las imágenes', () => {
    const job = visitFixture(), prompt = propertyVisitSegmentPrompt(job, job.segments[0]!);
    expect(prompt).toContain('appearance comes exclusively from the accepted frames');
    expect(prompt).toContain('No teleportation');
    expect(propertyVisitSegmentPrompt(job, job.segments[1]!)).toContain('Remain at this viewpoint');
  });
});
