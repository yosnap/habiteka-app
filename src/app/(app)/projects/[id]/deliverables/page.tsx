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
import type { QualityVerdict } from '@/lib/quality-verdict';
import type { DeliverablePayload, DeliverableType } from '@/lib/contracts';
import type { DesignVideoJob } from '@/lib/editor-document/design-video';
import { DesignVideoTask } from '@/components/editor-v2/design-video-task';
import type { EditorScope } from '@/server/editor/authority';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vista?: string; zona?: string }>;
}

type ResultsTab = 'disenos' | 'recorridos' | 'videos';
type VideoView = {
  id: string;
  mode: 'walkthrough' | 'showcase' | 'images' | 'promotion' | 'construction' | 'construction-ai';
  scope: EditorScope;
  designJob: DesignVideoJob | null;
  url: string | null;
  durationMs?: number;
  approvedRevision: number | null;
  designHref: string | null;
  legalSeal: string;
};

function videoMode(payload: unknown): VideoView['mode'] {
  if (!payload || typeof payload !== 'object' || !('mode' in payload)) return 'walkthrough';
  return payload.mode === 'showcase' || payload.mode === 'images' || payload.mode === 'promotion' || payload.mode === 'construction' || payload.mode === 'construction-ai' ? payload.mode : 'walkthrough';
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
        scope: { projectId: id, zoneId: row.zoneId }, designJob: videoMode(row.payload) === 'construction-ai' ? row.payload as unknown as DesignVideoJob : null,
        approvedRevision: typeof payload.approvedRevision === 'number' && Number.isSafeInteger(payload.approvedRevision) ? payload.approvedRevision : null,
        designHref: approvalId ? `/projects/${encodeURIComponent(id)}/editor?${designQuery}` : null,
        legalSeal: row.legalSeal };
    }));
    return <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <ResultsTabs tabs={tabs} active={activeTab} href={tabHref} />
      <a href={`/projects/${encodeURIComponent(id)}/videos${query.zona ? `?zona=${encodeURIComponent(query.zona)}` : ''}`} className="self-start rounded-control bg-brand-600 px-4 py-3 text-sm font-medium text-white">Crear vídeo</a>
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
  'construction-ai': 'Construcción desde diseños · piloto H3',
  construction: 'Construcción del edificio · 3D',
  walkthrough: 'Recorrido 3D del editor', showcase: 'Muestra 3D · obra + recorrido', images: 'Montaje de diseños generados', promotion: 'Muestra 3D sobre la parcela' };

function VideoCard({ video }: { video: VideoView }) {
  if (video.designJob) return <DesignVideoTask scope={video.scope} id={video.id} initial={video.designJob} initialUrl={video.url} />;
  const showcase = video.mode !== 'walkthrough';
  return <section aria-label={VIDEO_LABEL[video.mode]} className="border-line bg-surface flex flex-col gap-3 rounded-card border p-4">
    <h2 className="text-ink text-base font-semibold">{VIDEO_LABEL[video.mode]}{' '}
      {video.durationMs ? <span className="text-ink-soft ml-2 text-sm font-normal">{Math.round(video.durationMs / 1000)} s</span> : null}
    </h2>
    <p className="text-ink-soft text-sm">{video.mode === 'images' ? 'Presentación de imágenes con zoom y fundidos; no es una visita continua.'
      : 'Exportación del modelo editable; no incorpora los acabados y la decoración de las imágenes generadas por IA.'}</p>
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
