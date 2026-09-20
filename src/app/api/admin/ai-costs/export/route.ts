import { ForbiddenAdminError, requireAdmin } from '@/server/admin/guard';
import { prisma } from '@/server/db/prisma';
import { aiCostFilterParams } from '@/server/analytics/ai-cost-filter-params';
import { csvRow } from '@/lib/ai-cost-csv';

export async function GET(request: Request) {
  try { await requireAdmin(); }
  catch (error) {
    if (error instanceof ForbiddenAdminError) return new Response('Acceso restringido', { status: 403 });
    throw error;
  }
  const filters = aiCostFilterParams(new URL(request.url).searchParams);
  const encoder = new TextEncoder();
  let cursor: string | undefined;
  let header = false;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (!header) {
          controller.enqueue(encoder.encode('\uFEFF' + csvRow(['Fecha UTC', 'Petición', 'Intento', 'Organización', 'Usuario', 'Proyecto', 'Diseño', 'Lote', 'Acción', 'Operación', 'Proveedor', 'Modelo', 'Estado', 'Error', 'Latencia ms', 'Consumo', 'Coste USD', 'Tipo coste'])));
          header = true;
        }
        const rows = await prisma.aiRequestCost.findMany({
          where: { createdAt: { gte: filters.from, lte: filters.to }, provider: filters.provider, model: filters.model, status: filters.status },
          orderBy: { id: 'asc' }, take: 500, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        for (const row of rows) controller.enqueue(encoder.encode(csvRow([row.createdAt.toISOString(), row.requestId, row.attempt,
          row.organizationId, row.userId, row.projectId, row.refId, row.batchId, row.action, row.operation, row.provider, row.model,
          row.status, row.errorCode, row.latencyMs, row.units, row.costUsd?.toString(), row.costType])));
        cursor = rows.at(-1)?.id;
        if (rows.length < 500) controller.close();
      } catch (error) { controller.error(error); }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="gastos-ia.csv"', 'Cache-Control': 'no-store' } });
}
