/**
 * GET /api/catalog/[kind]/model
 *
 * Sirve el modelo .glb 3D de un item de catálogo (custom de la org o global de tienda)
 * como una REDIRECCIÓN a una URL presignada fresca de S3/MinIO. La URL de esta ruta es
 * ESTABLE (no caduca), lo que permite al render 3D usarla directamente en `useGLTF` sin
 * gestionar la caducidad de las presignadas: cada petición genera una nueva.
 *
 * Si el item no existe, no tiene .glb (modelKey null) o no pertenece a la org del usuario
 * (anti-IDOR), responde 404 y el render cae al placeholder.
 */
import { NextResponse } from 'next/server';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { prisma } from '@/server/db/prisma';
import { presignedGet } from '@/server/storage/client';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params;
  const ctx = await requireOrgContext();

  const item = await prisma.catalogItem.findFirst({
    where: {
      kind,
      OR: [{ organizationId: ctx.organizationId }, { organizationId: null }],
      deletedAt: null,
      modelKey: { not: null },
    },
    select: { modelKey: true },
  });

  if (!item?.modelKey) {
    return NextResponse.json({ error: 'Modelo no encontrado' }, { status: 404 });
  }

  // Presignada de 10 min: sobra para una carga, y si se re-pide (p. ej. re-montar el
  // componente) la ruta genera otra fresca. Redirigir (no stream) para no pasar el binario
  // por el servidor y dejar que el navegador cachee el GLB final.
  const url = await presignedGet(item.modelKey, 600);
  return NextResponse.redirect(url);
}
