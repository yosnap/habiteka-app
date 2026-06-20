/**
 * Pantalla de un proyecto: carga el estado del canvas en el servidor y monta el
 * workspace de edición. La carga pasa por el repositorio con ámbito (aislamiento
 * por organización); el guardado se delega a una Server Action.
 */
import { notFound } from 'next/navigation';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { loadCanvas, saveCanvas } from '@/server/actions/canvas';
import { CanvasWorkspace } from '@/components/canvas/canvas-workspace';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const ctx = await requireOrgContext();

  const project = await withOrg(ctx).projects.findById(id);
  if (!project) notFound();

  const initialDoc = await loadCanvas(id);

  return (
    <main className="flex h-[calc(100vh-3rem)] flex-col gap-3 p-4">
      <h1 className="text-lg font-semibold tracking-tight">{project.title}</h1>
      <div className="min-h-0 flex-1">
        <CanvasWorkspace projectId={id} initialDoc={initialDoc} saveAction={saveCanvas} />
      </div>
    </main>
  );
}
