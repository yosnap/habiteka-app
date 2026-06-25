/**
 * GET /api/catalog
 *
 * Devuelve los items de catálogo personalizados (custom) y de tienda (store)
 * accesibles para la organización del usuario en sesión.
 *
 * Parámetros opcionales:
 *   ?category=<string>  — filtra por categoría
 *   ?q=<string>         — filtra por label o kind (case-insensitive)
 *
 * Los items builtin viven en código (src/canvas/catalog.ts) y no pasan por aquí.
 * El cliente los carga directamente; esta ruta solo sirve los que vienen de BD.
 */
import { NextResponse } from 'next/server';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { prisma } from '@/server/db/prisma';
import { presignedGet } from '@/server/storage/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await requireOrgContext();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') ?? undefined;
  const q = searchParams.get('q')?.trim().toLowerCase() ?? undefined;

  const rows = await prisma.catalogItem.findMany({
    where: {
      // Items de la org del usuario O items globales de tienda (organizationId null)
      OR: [{ organizationId: ctx.organizationId }, { organizationId: null }],
      deletedAt: null,
      ...(category ? { category } : {}),
    },
    orderBy: [{ category: 'asc' }, { label: 'asc' }],
  });

  const filtered = rows.filter((r) => {
    if (!q) return true;
    return r.label.toLowerCase().includes(q) || r.kind.toLowerCase().includes(q);
  });

  // Generar URLs presignadas en paralelo (1 hora de vigencia).
  const items = await Promise.all(
    filtered.map(async (r) => ({
      id: r.id,
      kind: r.kind,
      label: r.label,
      source: r.source,
      category: r.category,
      family: r.family ?? undefined,
      thumbnailUrl: r.thumbnailKey ? await presignedGet(r.thumbnailKey).catch(() => null) : null,
      widthM: r.widthM,
      depthM: r.depthM,
      heightM: r.heightM,
      storeSlug: r.storeSlug ?? undefined,
      storeProductId: r.storeProductId ?? undefined,
      storePrice: r.storePrice ? Number(r.storePrice) : undefined,
      storeProductUrl: r.storeProductUrl ?? undefined,
      tags: (r.tags as string[]) ?? [],
    })),
  );

  return NextResponse.json({ items });
}
