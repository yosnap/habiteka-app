/**
 * Historial del proyecto: galería de "subí esto → generé esto". Agrupa cada imagen
 * de origen con los diseños que produjo, más un grupo para los diseños sin imagen
 * de origen (proyectos previos a la trazabilidad). La galería es de solo lectura;
 * la pestaña de versiones del plano permite recuperar una revisión anterior.
 *
 * Las URLs de las imágenes de origen se generan presignadas al servir (no se
 * persisten, caducarían); si el storage no está disponible, la galería degrada
 * mostrando los diseños sin la miniatura de origen en vez de romper la vista.
 */
import { requireOrgContext } from '@/server/auth/require-org-context';
import { readVideoTitle } from '@/lib/editor-document/video-title';
import { withOrg } from '@/server/db/scoped-repo';
import { resolveSourceImageUrls } from '@/server/storage/source-image-urls';
import { resolveRenderUrl } from '@/server/storage/render-urls';
import { groupHistory } from '@/lib/history-grouping';
import {
  HistoryGallery,
  type HistoryDeliverable,
} from '@/components/deliverables/history-gallery';
import type { DeliverablePayload, DeliverableType } from '@/lib/contracts';
import { ProjectVersionHistory } from '@/components/editor-v2/session/project-version-history';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vista?: string; pagina?: string; revision?: string; zona?: string }>;
}

export default async function HistorialPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const versions = query.vista === 'versiones';
  // El layout del proyecto ya validó la sesión y la pertenencia.
  const ctx = await requireOrgContext();
  const historyHref = `/projects/${encodeURIComponent(id)}/historial`;
  if (versions) return <main className="mx-auto flex max-w-7xl flex-col gap-4 p-4">
    <HistoryTabs base={historyHref} versions />
    <ProjectVersionHistory ctx={ctx} projectId={id} query={query} />
  </main>;
  const repo = withOrg(ctx);
  const [rows, sourceImages] = await Promise.all([
    repo.deliverables.list(id),
    repo.sourceImages.list(id),
  ]);

  const urlBySourceImageId = await resolveSourceImageUrls(sourceImages);
  const deliverables = (await Promise.all(rows.map(toHistoryDeliverable))).filter(
    (d): d is HistoryDeliverable => d !== null,
  );

  // La resolución de URLs vive en `@/server/storage/source-image-urls` y la
  // agrupación pura en `@/lib/history-grouping` (testeable sin IO).
  const groups = groupHistory(sourceImages, deliverables, urlBySourceImageId);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-3 p-4">
      <HistoryTabs base={historyHref} versions={false} />
      <HistoryGallery groups={groups} />
    </main>
  );
}

function HistoryTabs({ base, versions }: { base: string; versions: boolean }) {
  const tabClass = (active: boolean) => `rounded-lg px-4 py-2 text-sm font-medium ${active
    ? 'bg-emerald-800 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`;
  return <nav aria-label="Secciones del historial" className="flex gap-2 border-b border-slate-200 pb-3">
    <a href={base} aria-current={!versions ? 'page' : undefined} className={tabClass(!versions)}>Diseños y archivos</a>
    <a href={`${base}?vista=versiones`} aria-current={versions ? 'page' : undefined} className={tabClass(versions)}>Versiones del plano</a>
  </nav>;
}

// Resume un entregable para la galería: tipo + (si es render) su URL fresca.
async function toHistoryDeliverable(row: {
  id: string;
  type: string;
  payload: unknown;
  sourceImageId: string | null;
}): Promise<HistoryDeliverable | null> {
  if (row.type === 'VIDEO') {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload as { assetKey?: string; mode?: string } : {};
    return { id: row.id, type: 'video', videoTitle: readVideoTitle(row.payload), renderUrl: null,
      videoMode: payload.mode === 'advertising' ? 'advertising' : payload.mode === 'construction-ai' ? 'construction-ai' : payload.mode === 'construction' ? 'construction' : payload.mode === 'images' ? 'images' : payload.mode === 'promotion' ? 'promotion' : payload.mode === 'showcase' ? 'showcase' : 'walkthrough',
      videoUrl: await resolveRenderUrl(payload), sourceImageId: row.sourceImageId };
  }
  const payload = row.payload as DeliverablePayload | null;
  if (!payload || typeof payload !== 'object' || !('type' in payload)) return null;
  // El render se re-firma desde su `assetKey` (la presignada guardada caduca → imagen rota).
  const renderUrl = payload.type === 'render3d' ? await resolveRenderUrl(payload) : null;
  return {
    id: row.id,
    type: payload.type as DeliverableType,
    renderUrl,
    sourceImageId: row.sourceImageId,
  };
}
