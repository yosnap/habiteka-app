/**
 * Comparativa por proveedor y modelo: lo que costó y qué score medio sacaron los
 * resultados que produjo (solo los que tienen evaluación posterior puntuada).
 */
import type { QualityProviderRow } from '@/server/admin/analytics/quality-queries';

function usd(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
  }).format(amount);
}

export function QualityProviderTable({ rows }: { rows: QualityProviderRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-card border-line text-muted-foreground border p-6 text-center text-sm">
        No hay peticiones de IA en este rango de fechas.
      </p>
    );
  }
  return (
    <div className="rounded-card border-line overflow-x-auto border">
      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-muted-foreground text-left">
          <tr>
            <th className="px-3 py-2">Proveedor</th>
            <th className="px-3 py-2">Modelo</th>
            <th className="px-3 py-2">Intentos</th>
            <th className="px-3 py-2">Coste</th>
            <th className="px-3 py-2">Resultados puntuados</th>
            <th className="px-3 py-2">Score medio</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-line border-t">
              <td className="px-3 py-2 font-medium">{row.provider}</td>
              <td className="px-3 py-2">{row.model}</td>
              <td className="px-3 py-2">{row.attempts}</td>
              <td className="px-3 py-2">{usd(row.costUsd)}</td>
              <td className="px-3 py-2">{row.scored}</td>
              <td className="px-3 py-2">
                {row.avgScore === null ? '—' : `${row.avgScore.toFixed(1)} / 100`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
