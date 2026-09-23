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

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DeliverablesPage({ params }: Props) {
  const { id } = await params;
  // El layout del proyecto ya validó la sesión y la pertenencia.
  const ctx = await requireOrgContext();
  const repo = withOrg(ctx);
  const [rows, sourceImages] = await Promise.all([
    repo.deliverables.list(id),
    repo.sourceImages.list(id),
  ]);
  // La URL de la imagen de origen se genera fresca al servir (presignada de vida
  // corta): persistirla en BD la dejaría caducada para visitas posteriores (M1).
  // Si el storage no está disponible (p. ej. credenciales ausentes en dev), se
  // degrada mostrando el diseño SIN la miniatura de origen, no rompiendo la vista.
  const urlBySourceImageId = await resolveSourceImageUrls(sourceImages);

  const videos = await Promise.all(rows.filter((row) => row.type === 'VIDEO').map(async (row) => {
    const payload = row.payload as { assetKey?: string; durationMs?: number };
    return { id: row.id, url: await resolveRenderUrl(payload), durationMs: payload.durationMs, legalSeal: row.legalSeal };
  }));
  // Calidad registrada de cada entregable (evaluación posterior a la generación).
  // Si la consulta falla, los diseños se muestran igual: es información, no una puerta.
  const qualityByRef = await latestQualityByRef(
    ctx.organizationId,
    rows.map((row) => row.id),
  ).catch(() => new Map<string, QualityVerdict>());
  const deliverables = (
    await Promise.all(
      rows
        .filter((row) => row.type !== 'VIDEO')
        .map((row) => toDeliverableView(row, urlBySourceImageId, qualityByRef)),
    )
  ).filter((d): d is DeliverableView => d !== null);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-3 p-4">
      {videos.map((video) => <section key={video.id} aria-label="Recorrido en vídeo" className="rounded-lg border p-4">
        <h2>Recorrido 3D · {Math.round((video.durationMs ?? 0) / 1000)} s</h2>
        {video.url ? <><video controls preload="metadata" src={video.url} className="w-full" /><a href={video.url} download="habiteka-recorrido.mp4">Descargar MP4</a></> : <p>Vídeo no disponible temporalmente.</p>}
        <p className="text-xs text-muted-foreground">{video.legalSeal}</p>
      </section>)}
      {(deliverables.length > 0 || videos.length === 0) && <DeliverablesPanel deliverables={deliverables} projectId={id} />}
    </main>
  );
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
