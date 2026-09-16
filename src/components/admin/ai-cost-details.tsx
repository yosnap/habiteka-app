import type { AiCostDetail } from '@/server/analytics/ai-cost-queries';

const costLabels: Record<string, string> = { confirmed: 'Confirmado', estimated: 'Estimado', unknown: 'Desconocido' };
export function AiCostDetails({ rows }: { rows: AiCostDetail[] }) {
  const money = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', minimumFractionDigits: 4 }).format(amount);
  return <table className="w-full text-xs">
    <thead className="bg-surface-muted text-left text-muted-foreground"><tr>
      {['Fecha UTC', 'Petición', 'Proveedor / modelo', 'Estado', 'Coste', 'Trazabilidad'].map(label => <th key={label} className="px-3 py-2">{label}</th>)}
    </tr></thead>
    <tbody>{rows.map(row => <tr key={row.id} className="border-t border-line align-top">
      <td className="whitespace-nowrap px-3 py-3">{row.createdAt.toLocaleString('es-ES', { timeZone: 'UTC' })}</td>
      <td className="px-3 py-3"><span className="font-mono" title={row.requestId}>{row.requestId.slice(0, 8)}…</span>
        <p className="mt-1 text-muted-foreground">{row.action} · Intento {row.attempt + 1}{row.attempt > 0 ? ' (respaldo)' : ''}</p></td>
      <td className="px-3 py-3">{row.provider}<p className="text-muted-foreground">{row.model}</p></td>
      <td className="px-3 py-3"><span className={row.status === 'success' ? 'text-emerald-700' : 'text-red-700'}>{row.status === 'success' ? 'Correcto' : 'Error'}</span>
        <p>{row.latencyMs.toLocaleString('es-ES')} ms</p>{row.errorCode && <p className="text-red-700">{row.errorCode}</p>}</td>
      <td className="px-3 py-3">{row.costUsd === null ? 'Sin dato' : money(row.costUsd)}<p className="text-muted-foreground">{costLabels[row.costType] ?? row.costType}</p></td>
      <td className="max-w-xs px-3 py-3"><details><summary className="cursor-pointer">Ver registro</summary>
        <dl className="mt-2 space-y-1 break-all">
          {Object.entries({ Petición: row.requestId, Usuario: row.userId, Proyecto: row.projectId,
            Diseño: row.refId, Lote: row.batchId, Consumo: row.units ? JSON.stringify(row.units) : null }).map(([label, value]) =>
            <div key={label}><dt className="font-medium">{label}</dt><dd>{value ?? 'Sin dato'}</dd></div>)}
        </dl>
      </details></td>
    </tr>)}</tbody>
  </table>;
}
