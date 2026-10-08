/**
 * GET /api/projects/:id/export
 *
 * Descarga el proyecto de la organización en sesión como `.habiteka` (ZIP con su
 * índice y sus archivos), para importarlo en otra cuenta o instalación.
 */
import { requireOrgContext } from '@/server/auth/require-org-context';
import { exportProjectArchive } from '@/server/project-transfer/export-project';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  try {
    const { title, archive } = await exportProjectArchive(ctx, id);
    const name = title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'proyecto';
    return new Response(archive as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${name}.habiteka"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'No se pudo exportar el proyecto.', { status: 404 });
  }
}
