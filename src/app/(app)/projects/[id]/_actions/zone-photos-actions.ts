'use server';

/**
 * Server Actions del panel de fotos por zona (F2). Finas: resuelven la organización
 * de la sesión, validan la pertenencia del proyecto/zona (anti-IDOR) y delegan en el
 * repo con ámbito + el storage. Centralizan la subida de fotos del espacio (antes
 * solo en la ingesta del chat) para que el asistente y el plano usen el mismo flujo.
 *
 * La foto ACTIVA de la zona (`role = PRIMARY`) es la referencia que usa el render por
 * foto (F1, img2img). Subir una foto la deja activa; el resto pasa a DETAIL.
 */
import { revalidatePath } from 'next/cache';
import { requireOrgContext } from '@/server/auth/require-org-context';
import type { OrgContext } from '@/server/auth/org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { getStorageAdapter } from '@/server/storage/s3-storage-adapter';
import { resolveSourceImageUrls } from '@/server/storage/source-image-urls';
import { persistSourceImage } from '@/server/agent/persistence/source-image-repo';
import { assertConsent } from '@/server/privacy/consent-service';

/** Foto de una zona lista para la UI: miniatura presignada + si es la activa. */
export interface ZonePhoto {
  id: string;
  /** URL presignada de descarga (vida corta); '' si el storage no está disponible. */
  url: string;
  /** True si es la foto ACTIVA de la zona (la que usa el render). */
  active: boolean;
  createdAt: string;
}

async function assertProjectInOrg(ctx: OrgContext, projectId: string): Promise<void> {
  const project = await withOrg(ctx).projects.findById(projectId);
  if (!project) throw new Error('Proyecto no encontrado en tu organización');
}

/** Valida que la zona (si se indica) pertenece al proyecto de la org. */
async function assertZoneInProject(
  ctx: OrgContext,
  projectId: string,
  zoneId: string | null,
): Promise<string | null> {
  if (!zoneId) return null;
  const zones = await withOrg(ctx).zones.list(projectId);
  if (!zones.some((z) => z.id === zoneId)) {
    throw new Error('Zona no encontrada en el proyecto');
  }
  return zoneId;
}

/** Lista las fotos de una zona (miniaturas presignadas), la activa marcada. */
export async function listZonePhotos(
  projectId: string,
  zoneId: string | null = null,
): Promise<ZonePhoto[]> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  const zid = await assertZoneInProject(ctx, projectId, zoneId);

  const rows = await withOrg(ctx).sourceImages.listByZone(projectId, zid);
  const urls = await resolveSourceImageUrls(rows);
  return rows.map((r) => ({
    id: r.id,
    url: urls.get(r.id) ?? '',
    active: r.role === 'PRIMARY',
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Sube una foto a la zona y la deja ACTIVA. Persiste el binario (saneado: strip de
 * EXIF + re-codificación) y registra la fila con scope de org; luego fija esa foto
 * como PRIMARY (el resto a DETAIL). Exige consentimiento de tratamiento de imágenes
 * (RGPD), igual que la ingesta del chat.
 */
export async function uploadZonePhoto(
  projectId: string,
  zoneId: string | null,
  image: { base64: string; mimeType: string },
): Promise<ZonePhoto[]> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  const zid = await assertZoneInProject(ctx, projectId, zoneId);
  await assertConsent(ctx.userId, 'IMAGE_PROCESSING');

  const base64 = String(image?.base64 ?? '');
  if (!base64) throw new Error('Imagen vacía');
  const body = Buffer.from(base64, 'base64');

  const { id } = await persistSourceImage(withOrg(ctx), getStorageAdapter(), {
    organizationId: ctx.organizationId,
    projectId,
    zoneId: zid,
    body,
  });
  // La recién subida pasa a ACTIVA (PRIMARY); el resto de la zona a DETAIL. Evita
  // que queden dos PRIMARY tras una subida (persistSourceImage crea con PRIMARY).
  await withOrg(ctx).sourceImages.setActive(projectId, zid, id);

  revalidatePath(`/projects/${projectId}`);
  return listZonePhotos(projectId, zid);
}

/** Marca una foto de la zona como ACTIVA (la usa el render). No-op si es ajena. */
export async function setActiveZonePhoto(
  projectId: string,
  zoneId: string | null,
  sourceImageId: string,
): Promise<ZonePhoto[]> {
  const ctx = await requireOrgContext();
  await assertProjectInOrg(ctx, projectId);
  const zid = await assertZoneInProject(ctx, projectId, zoneId);

  await withOrg(ctx).sourceImages.setActive(projectId, zid, String(sourceImageId ?? ''));
  revalidatePath(`/projects/${projectId}`);
  return listZonePhotos(projectId, zid);
}
