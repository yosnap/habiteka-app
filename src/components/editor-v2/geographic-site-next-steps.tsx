'use client';
import Link from 'next/link';

export interface SiteNextStepsProps {
  onReviewApproval?: () => void;
  onOpenApproved?: () => void;
  approvalDisabled?: boolean;
  videoResultsHref?: string;
}

export function GeographicSiteNextSteps({ confirmed, readOnly, projectId, onReviewApproval, onOpenApproved, approvalDisabled, videoResultsHref }: SiteNextStepsProps & {
  confirmed: boolean; readOnly: boolean; projectId: string;
}) {
  const action = onReviewApproval ?? onOpenApproved;
  return <section aria-label="Continuar hacia el vídeo" className="w-full space-y-2 border-t pt-3 text-sm">
    <div>
      <h3 className="font-semibold">Continuar hacia el vídeo</h3>
      <p className="mt-1 text-xs text-ink-soft">{confirmed
        ? onReviewApproval ? 'Encaje confirmado. Aprueba esta revisión para vincularla a tus imágenes y vídeos.' : 'Encaje confirmado. Puedes revisar la aprobación y abrir tus vídeos.'
        : 'Confirma el encaje para continuar con la aprobación. Puedes consultar los vídeos que ya tienes.'}</p>
    </div>
    <div className="flex flex-wrap gap-2">
      {action && <button type="button" disabled={!confirmed || readOnly || approvalDisabled}
        className="rounded-lg border border-brand-600 px-4 py-2 font-medium text-brand-700 hover:bg-brand-50" onClick={action}>
        {onReviewApproval ? 'Revisar y aprobar diseño' : 'Ver aprobado'}
      </button>}
      <Link href={videoResultsHref ?? `/projects/${encodeURIComponent(projectId)}/deliverables?vista=videos`}
        className="rounded-lg border px-4 py-2 font-medium hover:bg-stone-50">Abrir vídeos con mis imágenes</Link>
    </div>
    <p className="text-xs text-ink-soft">El montaje utiliza tus imágenes generadas, con zoom y fundidos. El paseo continuo fotorrealista sigue pendiente.</p>
  </section>;
}
