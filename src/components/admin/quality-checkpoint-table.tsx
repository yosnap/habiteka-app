/**
 * Reparto de decisiones por punto de control, con barra de proporción en CSS
 * (el proyecto no incluye librería de gráficos).
 *
 * «Evaluaciones» son DECISIONES de puerta, no llamadas a Jev: una decisión
 * servida desde la caché por evidencia cuenta aquí (columna «reutilizadas»)
 * pero no suma coste de Jev.
 */
import { checkpointKind, checkpointLabel } from '@/lib/quality-checkpoint-labels';
import type { QualityCheckpointRow } from '@/server/admin/analytics/quality-queries';

function pct(part: number, total: number): string {
  return total ? `${((100 * part) / total).toFixed(1)} %` : '—';
}

export function QualityCheckpointTable({ rows }: { rows: QualityCheckpointRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-card border-line text-muted-foreground border p-6 text-center text-sm">
        No hay evaluaciones de calidad en este rango de fechas.
      </p>
    );
  }
  return (
    <div className="rounded-card border-line overflow-x-auto border">
      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-muted-foreground text-left">
          <tr>
            <th className="px-3 py-2">Punto de control</th>
            <th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2">Evaluaciones</th>
            <th className="px-3 py-2">Reparto</th>
            <th className="px-3 py-2">Sigue</th>
            <th className="px-3 py-2">Confirma</th>
            <th className="px-3 py-2">Bloquea</th>
            <th className="px-3 py-2">Sin evaluar</th>
            <th className="px-3 py-2">Reutilizadas</th>
            <th className="px-3 py-2">Score medio</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.checkpoint} className="border-line border-t">
              <td className="px-3 py-2 font-medium">{checkpointLabel(row.checkpoint)}</td>
              <td className="text-muted-foreground px-3 py-2">{checkpointKind(row.checkpoint)}</td>
              <td className="px-3 py-2">{row.evaluations}</td>
              <td className="px-3 py-2">
                <DecisionBar row={row} />
              </td>
              <td className="px-3 py-2">{pct(row.proceed, row.evaluations)}</td>
              <td className="px-3 py-2">{pct(row.confirm, row.evaluations)}</td>
              <td className="px-3 py-2">
                {pct(row.block, row.evaluations)}
                {row.block > 0 ? (
                  <span className="text-muted-foreground block text-xs">
                    {row.blockedCut} cortaron gasto · {row.blockedInformative} informativos
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2">{pct(row.unevaluated, row.evaluations)}</td>
              <td className="px-3 py-2">{pct(row.reused, row.evaluations)}</td>
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

function DecisionBar({ row }: { row: QualityCheckpointRow }) {
  const total = row.evaluations || 1;
  const segments = [
    { key: 'proceed', value: row.proceed, className: 'bg-emerald-500', label: 'Sigue solo' },
    { key: 'confirm', value: row.confirm, className: 'bg-amber-500', label: 'Pide confirmar' },
    { key: 'block', value: row.block, className: 'bg-rose-500', label: 'Bloquea' },
  ].filter((segment) => segment.value > 0);
  return (
    <span className="bg-surface-muted flex h-2 w-40 overflow-hidden rounded-full">
      {segments.map((segment) => (
        <span
          key={segment.key}
          className={segment.className}
          style={{ width: `${(100 * segment.value) / total}%` }}
          title={`${segment.label}: ${segment.value}`}
        />
      ))}
    </span>
  );
}
