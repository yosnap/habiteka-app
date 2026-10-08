'use server';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { normalizeEditorScope, type EditorScope } from '@/server/editor/authority';
import { readPropertyVisit, updatePropertyVisit } from './property-visit-repo';
import { propertyVisitImageLocked } from '@/lib/editor-document/property-visit-job';

/** Preparar otro intento conserva los archivos anteriores y exige otra confirmación de gasto al generar. */
export async function retryPropertyVisitItem(rawScope: EditorScope, id: string, kind: 'image' | 'segment', itemId: string) {
  const scope = normalizeEditorScope(rawScope), ctx = await requireOrgContext(), row = await readPropertyVisit(ctx, scope, id);
  const job = structuredClone(row.job);
  if ([...job.images, ...job.segments].some(item => ['submitting', 'generating', 'unknown'].includes(item.state)))
    throw new Error('Resuelve los envíos en curso o inciertos antes de preparar otro intento.');
  if (kind === 'image') {
    if (propertyVisitImageLocked(job, itemId)) throw new Error('Ya hay vídeo generado con esta imagen: prepara otro paseo para cambiar su referencia sin perder el anterior.');
    const image = job.images.find(item => item.id === itemId);
    if (!image || !['review', 'rejected', 'failed'].includes(image.state)) throw new Error('Esta imagen no admite otro intento.');
    image.previousSourceIds = [...(image.previousSourceIds ?? []), ...(image.sourceId ? [image.sourceId] : [])];
    delete image.sourceId; delete image.error; image.state = 'pending';
  } else if (kind === 'segment') {
    const segment = job.segments.find(item => item.id === itemId);
    if (!segment || !['rejected', 'failed'].includes(segment.state)) throw new Error('Rechaza el tramo antes de preparar otro intento.');
    segment.attempts = [...(segment.attempts ?? []), { state: segment.state, taskId: segment.taskId, assetKey: segment.assetKey }];
    delete segment.taskId; delete segment.assetKey; delete segment.error; delete segment.reviewedAt; delete segment.reviewedBy;
    delete segment.sourceVersions; segment.state = 'pending';
    // La unión siguiente también debe volverse a revisar aunque conserve su vídeo.
    const next = job.segments[job.segments.indexOf(segment) + 1];
    if (next?.state === 'accepted') { next.state = 'review'; delete next.reviewedAt; delete next.reviewedBy; }
  } else throw new Error('Tipo de intento no válido.');
  delete job.assetKey; delete job.finalReviewedAt; delete job.finalReviewedBy;
  await updatePropertyVisit(ctx, scope, id, row.version, job);
}
