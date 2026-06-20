/**
 * Vista del panel de entregables de un proyecto. Carga los entregables a través
 * del repositorio con ámbito y los presenta con sus visores. El sello legal viaja
 * con cada entregable.
 */
import { notFound } from 'next/navigation';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { DeliverablesPanel } from '@/components/deliverables/deliverables-panel';
import type { Deliverable, DeliverablePayload, DeliverableType } from '@/lib/contracts';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DeliverablesPage({ params }: Props) {
  const { id } = await params;
  const ctx = await requireOrgContext();
  const project = await withOrg(ctx).projects.findById(id);
  if (!project) notFound();

  const rows = await withOrg(ctx).deliverables.list(id);
  const deliverables = rows.map(toDeliverable).filter((d): d is Deliverable => d !== null);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-3 p-4">
      <h1 className="text-lg font-semibold tracking-tight">{project.title} · Tus diseños</h1>
      <DeliverablesPanel deliverables={deliverables} />
    </main>
  );
}

// Reconstruye el entregable desde la fila, validando el tipo de payload.
function toDeliverable(row: {
  id: string;
  type: string;
  payload: unknown;
  legalSeal: string;
  version: number;
}): Deliverable | null {
  const payload = row.payload as DeliverablePayload | null;
  if (!payload || typeof payload !== 'object' || !('type' in payload)) return null;
  return {
    id: row.id,
    type: row.type as DeliverableType,
    payload,
    legalSeal: row.legalSeal,
    version: row.version,
  };
}
