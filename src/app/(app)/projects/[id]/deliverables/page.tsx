/**
 * Vista del panel de entregables de un proyecto. Carga los entregables a través
 * del repositorio con ámbito y los presenta con sus visores. El sello legal viaja
 * con cada entregable. Cuando un entregable tiene imagen de origen (trazabilidad
 * origen→diseño), se le adjunta su URL para mostrar el "subí esto ↔ generé esto".
 */
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { DeliverablesPanel, type DeliverableView } from '@/components/deliverables/deliverables-panel';
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

  const deliverables = rows
    .map((row) => toDeliverableView(row, urlBySourceImageId))
    .filter((d): d is DeliverableView => d !== null);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-3 p-4">
      <DeliverablesPanel deliverables={deliverables} projectId={id} />
    </main>
  );
}

// Genera las URLs presignadas de las imágenes de origen. Degrada a un mapa vacío
// si el storage no está disponible: la trazabilidad es un extra, no debe tumbar la
// vista de diseños.
async function resolveSourceImageUrls(
  sourceImages: Array<{ id: string; key: string }>,
): Promise<Map<string, string>> {
  if (sourceImages.length === 0) return new Map();
  try {
    const storage = getStorageAdapter();
    const entries = await Promise.all(
      sourceImages.map(
        async (img) => [img.id, await storage.getPresignedDownloadUrl(img.key)] as const,
      ),
    );
    return new Map(entries);
  } catch {
    return new Map();
  }
}

// Reconstruye el entregable desde la fila, validando el tipo de payload, y le
// adjunta la URL de su imagen de origen si la hay.
function toDeliverableView(
  row: {
    id: string;
    type: string;
    payload: unknown;
    legalSeal: string;
    version: number;
    sourceImageId: string | null;
  },
  urlBySourceImageId: Map<string, string>,
): DeliverableView | null {
  const payload = row.payload as DeliverablePayload | null;
  if (!payload || typeof payload !== 'object' || !('type' in payload)) return null;
  const sourceImageUrl = row.sourceImageId
    ? (urlBySourceImageId.get(row.sourceImageId) ?? null)
    : null;
  return {
    id: row.id,
    type: row.type as DeliverableType,
    payload,
    legalSeal: row.legalSeal,
    version: row.version,
    sourceImageUrl,
  };
}
