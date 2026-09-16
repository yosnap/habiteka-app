import { prisma } from '@/server/db/prisma';
import { requireAdmin } from '@/server/admin/guard';

export async function AiCreditSummary({ from, to }: { from: Date; to: Date }) {
  await requireAdmin();
  const data = await prisma.creditLedger.aggregate({ where: { createdAt: { gte: from, lte: to },
    reason: 'settle', delta: { lt: 0 } }, _sum: { delta: true }, _count: true });
  return <section className="rounded-card border border-line bg-surface p-4">
    <h2 className="font-semibold">Créditos de clientes · Contabilidad separada</h2>
    <p className="mt-2 text-2xl font-semibold">{Math.abs(data._sum.delta ?? 0).toLocaleString('es-ES')} créditos liquidados</p>
    <p className="mt-1 text-sm text-muted-foreground">{data._count} cargos confirmados en el período. Total global por fechas; no aplica filtros de proveedor o modelo. No equivale al coste del proveedor en USD.</p>
  </section>;
}
