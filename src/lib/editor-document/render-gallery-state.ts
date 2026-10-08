import type { Deliverable } from '@/lib/contracts';
import { renderReviewIssue } from './render-review';

export interface RenderAcceptanceSnapshot {
  accepted: boolean;
  version: number;
  acceptedAt: string | null;
}
export type RenderGalleryStatus = 'pending' | 'accepted' | 'rejected' | 'reference';
export const RENDER_STATUS_LABELS: Record<RenderGalleryStatus, string> = {
  pending: 'Pendiente de revisar', accepted: 'Aceptado', rejected: 'Descartado', reference: 'Solo referencia',
};

/** La auditoría nunca acepta un diseño. Un dato local no prevalece sobre una revisión posterior. */
export function renderGalleryState(item: Deliverable, saved?: RenderAcceptanceSnapshot) {
  const generation = item.payload.type === 'render3d' ? item.payload.generation : undefined;
  const sourceIsAI = Boolean(generation?.provider && generation.provider !== 'native');
  const current = saved && saved.version > item.version ? saved : undefined;
  const acceptance = generation?.acceptance;
  const recorded = Boolean(acceptance?.userId && Number.isFinite(Date.parse(acceptance.acceptedAt)));
  const accepted = sourceIsAI && (current ? current.accepted : recorded);
  const acceptedAt = accepted ? current?.acceptedAt ?? acceptance?.acceptedAt ?? null : null;
  const issue = renderReviewIssue(generation);
  const status: RenderGalleryStatus = !sourceIsAI ? 'reference' : issue ? 'rejected' : accepted ? 'accepted' : 'pending';
  return { status, accepted, acceptedAt, issue, sourceIsAI, version: current?.version ?? item.version };
}

export function renderBatchCounts(items: Deliverable[], saved: Record<string, RenderAcceptanceSnapshot> = {}) {
  const counts: Record<RenderGalleryStatus, number> = { accepted: 0, pending: 0, rejected: 0, reference: 0 };
  for (const item of items) counts[renderGalleryState(item, saved[item.id]).status] += 1;
  return counts;
}
