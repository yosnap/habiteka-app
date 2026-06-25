/**
 * Historial del proyecto: galería de "subí esto → generé esto". Agrupa cada imagen
 * de origen con los diseños que produjo, más un grupo para los diseños sin imagen
 * de origen (proyectos previos a la trazabilidad). Solo lectura.
 *
 * Las URLs de las imágenes de origen se generan presignadas al servir (no se
 * persisten, caducarían); si el storage no está disponible, la galería degrada
 * mostrando los diseños sin la miniatura de origen en vez de romper la vista.
 */
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { resolveSourceImageUrls } from '@/server/storage/source-image-urls';
import { resolveRenderUrl } from '@/server/storage/render-urls';
import { groupHistory } from '@/lib/history-grouping';
import {
  HistoryGallery,
  type HistoryDeliverable,
} from '@/components/deliverables/history-gallery';
import type { DeliverablePayload, DeliverableType } from '@/lib/contracts';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function HistorialPage({ params }: Props) {
  const { id } = await params;
  // El layout del proyecto ya validó la sesión y la pertenencia.
  const ctx = await requireOrgContext();
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
      <HistoryGallery groups={groups} />
    </main>
  );
}

// Resume un entregable para la galería: tipo + (si es render) su URL fresca.
async function toHistoryDeliverable(row: {
  id: string;
  type: string;
  payload: unknown;
  sourceImageId: string | null;
}): Promise<HistoryDeliverable | null> {
  const payload = row.payload as DeliverablePayload | null;
  if (!payload || typeof payload !== 'object' || !('type' in payload)) return null;
  // El render se re-firma desde su `assetKey` (la presignada guardada caduca → imagen rota).
  const renderUrl = payload.type === 'render3d' ? await resolveRenderUrl(payload) : null;
  return {
    id: row.id,
    type: row.type as DeliverableType,
    renderUrl,
    sourceImageId: row.sourceImageId,
  };
}
