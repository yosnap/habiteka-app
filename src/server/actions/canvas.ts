'use server';

/**
 * Server Actions del canvas.
 *
 * Persisten y recuperan el estado del lienzo a través del repositorio con ámbito
 * (aislamiento por organización). El payload del cliente NO se confía: se
 * normaliza con el (de)serializador del canvas antes de guardarlo, de modo que
 * datos corruptos o de otra versión no entran en la base.
 */
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { serializeCanvas, deserializeCanvas } from '@/canvas/serialize';
import type { BaseImage } from '@/canvas/types';
import { withLegacyAuthority } from '@/server/editor/authority';
import type { Prisma } from '@/generated/prisma/client';

export async function loadCanvas(projectId: string, zoneId: string | null = null) {
  const ctx = await requireOrgContext();
  const raw = await withOrg(ctx).canvas.load(projectId, zoneId);
  // Se devuelve ya normalizado para que el cliente hidrate un documento válido.
  return serializeCanvas(deserializeCanvas(raw));
}

export async function saveCanvas(
  projectId: string,
  payload: unknown,
  zoneId: string | null = null,
) {
  const ctx = await requireOrgContext();
  // Normaliza el payload del cliente: descarta lo inválido antes de persistir.
  const clean = serializeCanvas(deserializeCanvas(payload));
  await withOrg(ctx).canvas.save(projectId, clean, zoneId);
}

/**
 * Fija una imagen de fondo en el canvas del proyecto SIN perder el resto del
 * documento (trazos, objetos, productos). Se usa al "traer un render al lienzo"
 * desde el panel de entregables: como el canvas vive en otra página, hay que
 * persistir el fondo en servidor antes de navegar para que el editor lo hidrate.
 * El `baseImage` se reconstruye con el deserializador (valida url/medidas/opacidad).
 */
export async function applyBaseImageToCanvas(
  projectId: string,
  baseImage: BaseImage,
  zoneId: string | null = null,
) {
  const ctx = await requireOrgContext();
  // Aplica el fondo al plano de la zona que originó el diseño (zoneId del
  // entregable); sin zona, al plano por defecto. Parte del documento actual ya
  // normalizado y le sustituye solo el fondo, preservando trazos, objetos y
  // productos. Valida el `baseImage` con el deserializador antes de fundirlo.
  const cleanBaseImage = deserializeCanvas({ baseImage }).baseImage;
  await withLegacyAuthority(ctx, { projectId, zoneId }, async (tx) => {
    const row = await tx.canvasState.findFirst({ where: { projectId, zoneId } });
    const current = deserializeCanvas(row?.data ?? null);
    const data = serializeCanvas({
      ...current,
      baseImage: cleanBaseImage,
    }) as Prisma.InputJsonValue;
    if (row) await tx.canvasState.update({ where: { id: row.id }, data: { data } });
    else await tx.canvasState.create({ data: { projectId, zoneId, data } });
  });
}
