/**
 * Vista del panel de entregables de un proyecto. Carga los entregables a través
 * del repositorio con ámbito y los presenta con sus visores. El sello legal viaja
 * con cada entregable. Cuando un entregable tiene imagen de origen (trazabilidad
 * origen→diseño), se le adjunta su URL para mostrar el "subí esto ↔ generé esto".
 */
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { resolveSourceImageUrls } from '@/server/storage/source-image-urls';
import { resolveRenderUrl } from '@/server/storage/render-urls';
import { DeliverablesPanel, type DeliverableView } from '@/components/deliverables/deliverables-panel';
import { latestQualityByRef } from '@/server/quality/result-repo';
import { withEditorDocuments } from '@/server/editor/document-repo';
import { sameContentRevisions, tourImagesFromRows } from '@/server/walkthrough/tour-images';
import { ImageTourBuilder } from '@/components/deliverables/image-tour-builder';
import { WHOLE_PROPERTY } from '@/lib/editor-document/image-tour';
import type { QualityVerdict } from '@/lib/quality-verdict';
import type { DeliverablePayload, DeliverableType } from '@/lib/contracts';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vista?: string; zona?: string }>;
}

type ResultsTab = 'disenos' | 'recorridos' | 'videos';
type VideoView = {
  id: string;
  mode: 'walkthrough' | 'showcase' | 'images';
  url: string | null;
  durationMs?: number;
  approvedRevision: number | null;
  designHref: string | null;
  legalSeal: string;
};

function videoMode(payload: unknown): VideoView['mode'] {
  if (!payload || typeof payload !== 'object' || !('mode' in payload)) return 'walkthrough';
  return payload.mode === 'showcase' || payload.mode === 'images' ? payload.mode : 'walkthrough';
}
/** Los vídeos con obra y los montados con imágenes conviven en la pestaña «Vídeos». */
const inVideosTab = (mode: VideoView['mode']) => mode !== 'walkthrough';

export default async function DeliverablesPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const activeTab: ResultsTab = query.vista === 'recorridos' || query.vista === 'videos' ? query.vista : 'disenos';
  // El layout del proyecto ya validó la sesión y la pertenencia.
  const ctx = await requireOrgContext();
  const repo = withOrg(ctx);
  const rows = await repo.deliverables.list(id);
  const videoRows = rows.filter((row) => row.type === 'VIDEO');
  const tabs: { id: ResultsTab; label: string; count: number }[] = [
    { id: 'disenos', label: 'Diseños', count: rows.length - videoRows.length },
    { id: 'recorridos', label: 'Recorridos', count: videoRows.filter((row) => videoMode(row.payload) === 'walkthrough').length },
    { id: 'videos', label: 'Vídeos', count: videoRows.filter((row) => inVideosTab(videoMode(row.payload))).length },
  ];
  const tabHref = (tab: ResultsTab) => {
    const params = new URLSearchParams();
    if (tab !== 'disenos') params.set('vista', tab);
    if (query.zona) params.set('zona', query.zona);
    const suffix = params.toString();
    return `/projects/${encodeURIComponent(id)}/deliverables${suffix ? `?${suffix}` : ''}`;
  };

  if (activeTab !== 'disenos') {
    const scope = { projectId: id, zoneId: query.zona ?? null };
    const approval = activeTab === 'videos' ? await withEditorDocuments(ctx).latestApproval(scope) : null;
    // Las revisiones son por estado del editor (proyecto y zona): el montaje usa solo los renders del mismo ámbito.
    const tourImages = activeTab === 'videos' ? await tourImagesFromRows(rows.filter((row) => row.type === 'RENDER_3D' && (row.zoneId ?? null) === scope.zoneId)) : [];
    const validRevisions = approval ? await sameContentRevisions(ctx, scope, approval, tourImages.map((image) => image.revision)) : [];
    const ambients = [WHOLE_PROPERTY, ...(approval?.document.designZones ?? []).map((zone) => zone.name)];
    const videos = await Promise.all(videoRows.filter((row) =>
      inVideosTab(videoMode(row.payload)) === (activeTab === 'videos')).map(async (row): Promise<VideoView> => {
      const payload = row.payload && typeof row.payload === 'object'
        ? row.payload as { assetKey?: string; durationMs?: number; approvalId?: string; approvedRevision?: number }
        : {};
      const approvalId = typeof payload.approvalId === 'string' && payload.approvalId ? payload.approvalId : null;
      const designQuery = new URLSearchParams();
      if (approvalId) designQuery.set('aprobado', approvalId);
      if (row.zoneId) designQuery.set('zona', row.zoneId);
      return { id: row.id, mode: videoMode(row.payload), url: await resolveRenderUrl(payload), durationMs: payload.durationMs,
        approvedRevision: typeof payload.approvedRevision === 'number' && Number.isSafeInteger(payload.approvedRevision) ? payload.approvedRevision : null,
        designHref: approvalId ? `/projects/${encodeURIComponent(id)}/editor?${designQuery}` : null,
        legalSeal: row.legalSeal };
    }));
    return <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <ResultsTabs tabs={tabs} active={activeTab} href={tabHref} />
      {activeTab === 'videos' && <ImageTourBuilder key={`${tourImages.map((image) => image.id).join()}|${validRevisions.join()}`} projectId={id} zoneId={query.zona ?? null} approvalId={approval?.id ?? null}
        approvedRevision={approval?.revision ?? null} images={tourImages} ambients={ambients} validRevisions={validRevisions} />}
      {videos.length ? videos.map((video) => <VideoCard key={video.id} video={video} />) :
        <p className="text-muted-foreground p-6 text-center text-sm">{activeTab === 'recorridos'
          ? 'Aún no hay recorridos exportados de una revisión aprobada.'
          : 'Aún no hay vídeos guardados.'}</p>}
    </main>;
  }

  const sourceImages = await repo.sourceImages.list(id);
  // La URL de la imagen de origen se genera fresca al servir (presignada de vida
  // corta): persistirla en BD la dejaría caducada para visitas posteriores (M1).
  // Si el storage no está disponible (p. ej. credenciales ausentes en dev), se
  // degrada mostrando el diseño SIN la miniatura de origen, no rompiendo la vista.
  const urlBySourceImageId = await resolveSourceImageUrls(sourceImages);

  // Calidad registrada de cada entregable (evaluación posterior a la generación).
  // Si la consulta falla, los diseños se muestran igual: es información, no una puerta.
  const qualityByRef = await latestQualityByRef(
    ctx.organizationId,
    rows.filter((row) => row.type !== 'VIDEO').map((row) => row.id),
  ).catch(() => new Map<string, QualityVerdict>());
  const deliverables = (
    await Promise.all(
      rows
        .filter((row) => row.type !== 'VIDEO')
        .map((row) => toDeliverableView(row, urlBySourceImageId, qualityByRef)),
    )
  ).filter((d): d is DeliverableView => d !== null);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <ResultsTabs tabs={tabs} active={activeTab} href={tabHref} />
      <DeliverablesPanel deliverables={deliverables} projectId={id} />
    </main>
  );
}

function ResultsTabs({ tabs, active, href }: {
  tabs: { id: ResultsTab; label: string; count: number }[];
  active: ResultsTab;
  href: (tab: ResultsTab) => string;
}) {
  return <nav aria-label="Resultados del proyecto" className="border-line flex gap-2 overflow-x-auto border-b pb-3">
    {tabs.map((tab) => <a key={tab.id} href={href(tab.id)} aria-current={active === tab.id ? 'page' : undefined}
      className={`rounded-control shrink-0 px-4 py-2 text-sm font-medium ${active === tab.id
        ? 'bg-emerald-800 text-white' : 'border border-line bg-surface text-ink hover:bg-emerald-50'}`}>
      {tab.label} <span className="opacity-75">{tab.count}</span>
    </a>)}
  </nav>;
}

const VIDEO_LABEL: Record<VideoView['mode'], string> = {
  walkthrough: 'Recorrido grabado', showcase: 'Vídeo resumen · obra + recorrido', images: 'Vídeo con las imágenes generadas' };

function VideoCard({ video }: { video: VideoView }) {
  const showcase = video.mode !== 'walkthrough';
  return <section aria-label={VIDEO_LABEL[video.mode]} className="border-line bg-surface flex flex-col gap-3 rounded-card border p-4">
    <h2 className="text-ink text-base font-semibold">{VIDEO_LABEL[video.mode]}{' '}
      {video.durationMs ? <span className="text-ink-soft ml-2 text-sm font-normal">{Math.round(video.durationMs / 1000)} s</span> : null}
    </h2>
    {video.url ? <><video controls preload="metadata" src={video.url} className="w-full rounded-control" />
      <a href={video.url} download={showcase ? 'habiteka-muestra.mp4' : 'habiteka-recorrido.mp4'} className="text-emerald-800 underline">Descargar MP4</a></>
      : <p className="text-muted-foreground text-sm">Vídeo no disponible temporalmente.</p>}
    {video.designHref && <a href={video.designHref} className="text-ink text-sm underline">
      Abrir el diseño aprobado{video.approvedRevision !== null ? ` · revisión ${video.approvedRevision}` : ''}
    </a>}
    <p className="text-muted-foreground text-xs">{video.legalSeal}</p>
  </section>;
}

// Reconstruye el entregable desde la fila, validando el tipo de payload, y le
// adjunta la URL de su imagen de origen si la hay.
async function toDeliverableView(
  row: {
    id: string;
    type: string;
    payload: unknown;
    legalSeal: string;
    version: number;
    sourceImageId: string | null;
    zoneId: string | null;
  },
  urlBySourceImageId: Map<string, string>,
  qualityByRef: Map<string, QualityVerdict>,
): Promise<DeliverableView | null> {
  const payload = row.payload as DeliverablePayload | null;
  if (!payload || typeof payload !== 'object' || !('type' in payload)) return null;
  const sourceImageUrl = row.sourceImageId
    ? (urlBySourceImageId.get(row.sourceImageId) ?? null)
    : null;
  // El render se re-firma desde su `assetKey` (la presignada guardada caduca). Para
  // el resto de tipos el payload viaja intacto.
  const resolved =
    payload.type === 'render3d'
      ? { ...payload, assetUrl: (await resolveRenderUrl(payload)) ?? payload.assetUrl }
      : payload;
  return {
    id: row.id,
    type: payload.type as DeliverableType,
    payload: resolved,
    legalSeal: row.legalSeal,
    version: row.version,
    sourceImageUrl,
    zoneId: row.zoneId,
    quality: qualityByRef.get(row.id) ?? null,
  };
}
