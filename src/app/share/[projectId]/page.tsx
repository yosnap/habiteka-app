/**
 * Ruta pública de sharing: /share/[projectId]
 *
 * Carga el canvas del proyecto sin auth (el projectId actúa como token) y muestra
 * una vista 3D de solo lectura (orbit, sin edición). El cliente puede orbitar y
 * capturar renders pero no modificar el plano.
 */
import { prisma } from '@/server/db/prisma';
import { deserializeCanvas } from '@/canvas/serialize';
import type { CanvasDoc } from '@/canvas/types';
import { SharedViewer } from './shared-viewer';

export const dynamic = 'force-dynamic';

export default async function SharePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  // Carga directa (sin org context): el projectId es el "token" de sharing.
  const row = await prisma.canvasState.findFirst({
    where: {
      projectId,
      zoneId: null,
      project: { deletedAt: null, editorDocuments: { none: { zoneId: null } } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      title: true,
      editorDocuments: { where: { zoneId: null }, select: { id: true }, take: 1 },
    },
  });

  if (!row || !project || project.editorDocuments.length) {
    return (
      <div className="grid min-h-screen place-items-center bg-neutral-900 text-white">
        <p className="text-lg">Vista compartida no disponible.</p>
      </div>
    );
  }

  const doc = deserializeCanvas(row.data) as CanvasDoc;

  return <SharedViewer doc={doc} projectName={project.title} />;
}
