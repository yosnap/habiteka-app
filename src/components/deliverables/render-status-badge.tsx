import { CheckCircle2, Clock3, Image, TriangleAlert } from 'lucide-react';
import { RENDER_STATUS_LABELS, type RenderGalleryStatus } from '@/lib/editor-document/render-gallery-state';

const appearance = {
  accepted: { Icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  pending: { Icon: Clock3, className: 'border-amber-200 bg-amber-50 text-amber-950' },
  rejected: { Icon: TriangleAlert, className: 'border-red-200 bg-red-50 text-red-900' },
  reference: { Icon: Image, className: 'border-line bg-surface-muted text-ink-soft' },
};

export function RenderStatusBadge({ status }: { status: RenderGalleryStatus }) {
  const { Icon, className } = appearance[status];
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium ${className}`}>
    <Icon size={13} aria-hidden="true" />{RENDER_STATUS_LABELS[status]}
  </span>;
}
