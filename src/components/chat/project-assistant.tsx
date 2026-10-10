import type { ComponentProps } from 'react';
import { CheckCheck } from 'lucide-react';
import { prisma } from '@/server/db/prisma';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { notFound } from 'next/navigation';
import { advanceAgent } from '@/app/(app)/projects/[id]/_actions/agent-actions';
import { QualificationChat } from './qualification-chat';
import { PlanReviewPanel } from './plan-review-panel';

/** La conversación existente se comparte entre su página y el panel del editor. */
export async function ProjectAssistant({
  projectId,
  zoneId,
}: {
  projectId: string;
  zoneId: string | null;
}) {
  const ctx = await requireOrgContext();
  if (!(await withOrg(ctx).projects.findById(projectId))) notFound();
  const state = await prisma.agentState.findFirst({
    where: { projectId, zoneId },
    select: { phase: true, collected: true },
  });
  const initialCollected = (state?.collected ?? {}) as ComponentProps<
    typeof QualificationChat
  >['initialCollected'];
  const initialPhase = (state?.phase ?? 'ingesta') as ComponentProps<
    typeof QualificationChat
  >['initialPhase'];
  return (
    <div className="min-w-0 space-y-4">
      <QualificationChat
        projectId={projectId}
        zoneId={zoneId}
        advance={advanceAgent}
        initialPhase={initialPhase}
        initialCollected={initialCollected}
      />
      <details className="rounded-xl border border-line px-3 py-3 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-ink-soft">
          <CheckCheck size={18} />
          Revisar un plano dibujado
        </summary>
        <div className="mt-3">
          <PlanReviewPanel projectId={projectId} zoneId={zoneId} />
        </div>
      </details>
    </div>
  );
}
