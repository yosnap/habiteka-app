import { describe, expect, it } from 'vitest';
import type { Deliverable } from '@/lib/contracts';
import { renderBatchCounts, renderGalleryState } from '@/lib/editor-document/render-gallery-state';

type Generation = NonNullable<Extract<Deliverable['payload'], { type: 'render3d' }>['generation']>;
const acceptedAt = '2026-10-01T10:00:00.000Z';
const acceptance = { userId: 'test-user', acceptedAt };
const rejection = { status: 'rejected' as const, reason: 'Falta un tabique', reviewedAt: '2026-10-02T10:00:00.000Z' };
const render = (id: string, generation: Partial<Generation> = {}, version = 1): Deliverable => ({
  id, type: 'render3d', version, legalSeal: 'conceptual', payload: { type: 'render3d', assetUrl: '/image.png',
    generation: { provider: 'test-ai', promptVersion: 'test', documentRevision: 1, ...generation } },
});

describe('estado de revisión de la galería', () => {
  it('un resultado IA sin decisión explícita sigue pendiente', () => {
    expect(renderGalleryState(render('pending'))).toMatchObject({ status: 'pending', accepted: false, acceptedAt: null });
  });
  it.each([{ userId: '', acceptedAt }, { userId: 'test-user', acceptedAt: 'invalid' }])('no interpreta una aceptación incompleta como válida: %j', value => {
    expect(renderGalleryState(render('incomplete', { acceptance: value })).status).toBe('pending');
  });
  it('conserva fecha y versión de la aceptación registrada por el usuario', () => {
    expect(renderGalleryState(render('accepted', { acceptance }, 3))).toMatchObject({ status: 'accepted', accepted: true, acceptedAt, version: 3 });
  });
  it.each(['native', undefined])('el origen %s no sirve como diseño final aunque tenga aceptación', provider => {
    expect(renderGalleryState(render('reference', { provider, acceptance }))).toMatchObject({ status: 'reference', accepted: false, acceptedAt: null });
  });
  it('muestra un descarte por encima de una aceptación anterior y conserva su trazabilidad', () => {
    expect(renderGalleryState(render('rejected', { review: rejection, acceptance })))
      .toMatchObject({ status: 'rejected', accepted: true, acceptedAt, issue: rejection.reason });
  });
  it('refleja aceptar y retirar antes de que lleguen las nuevas props del servidor', () => {
    const pending = render('pending');
    expect(renderGalleryState(pending, { accepted: true, acceptedAt, version: 2 }))
      .toMatchObject({ status: 'accepted', acceptedAt, version: 2 });
    const accepted = render('accepted', { acceptance }, 2);
    expect(renderGalleryState(accepted, { accepted: false, acceptedAt: null, version: 3 }))
      .toMatchObject({ status: 'pending', accepted: false, acceptedAt: null, version: 3 });
  });
  it('una versión más reciente del servidor invalida la copia local', () => {
    expect(renderGalleryState(render('updated', {}, 4), { accepted: true, acceptedAt, version: 2 }))
      .toMatchObject({ status: 'pending', accepted: false, version: 4 });
    expect(renderGalleryState(render('updated', { acceptance }, 4), { accepted: false, acceptedAt: null, version: 3 }))
      .toMatchObject({ status: 'accepted', acceptedAt, version: 4 });
  });
  it('el servidor también es la fuente de verdad cuando ya alcanzó la versión local', () => {
    expect(renderGalleryState(render('refreshed', {}, 2), { accepted: true, acceptedAt, version: 2 }))
      .toMatchObject({ status: 'pending', accepted: false, version: 2 });
  });
  it('una aceptación local nunca tapa un descarte del servidor', () => {
    expect(renderGalleryState(render('updated', { review: rejection }), { accepted: true, acceptedAt, version: 2 }).status).toBe('rejected');
  });
  it('una auditoría fallida bloquea aunque falte review o quede una aceptación antigua', () => {
    expect(renderGalleryState(render('failed', { acceptance, fidelity: { version: 'spatial-fidelity-v2', status: 'rejected',
      checkedAt: acceptedAt, roomChecks: [], openingChecks: [] } })).status).toBe('rejected');
  });
  it('resume cada imagen una vez, excluyendo descartadas del recuento de aceptadas', () => {
    const items = [render('a', { acceptance }), render('b'), render('c', { acceptance, review: rejection }), render('d', { provider: 'native' }), render('e')];
    expect(renderBatchCounts(items, { e: { accepted: true, acceptedAt, version: 2 } }))
      .toEqual({ accepted: 2, pending: 1, rejected: 1, reference: 1 });
  });
});
