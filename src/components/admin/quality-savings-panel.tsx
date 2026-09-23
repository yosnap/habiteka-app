/**
 * Ahorro estimado por las puertas previas y balance frente al coste de Jev.
 * El método de estimación se explica aquí mismo: un bloqueo previo evita una
 * generación que nunca existió, así que no hay coste observado que enseñar.
 *
 * Solo cuentan como ahorro los bloqueos que CORTARON una acción de pago. Un
 * plano puntuado bajo al leerlo, sin generación detrás, se lista aparte como
 * bloqueo informativo: evita creer que se ahorró algo que nadie iba a gastar.
 */
import { checkpointLabel } from '@/lib/quality-checkpoint-labels';
import type { QualityEfficacyReport } from '@/server/admin/analytics/quality-queries';

function usd(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
  }).format(amount);
}

export function QualitySavingsPanel({ report }: { report: QualityEfficacyReport }) {
  const { savings, informative, cost, estimateBasis } = report;
  return (
    <section className="rounded-card border-line bg-surface border p-4">
      <h2 className="font-semibold">Tokens y coste evitados por las puertas previas</h2>
      <p className="text-muted-foreground mt-1 text-xs">
        Método: cada bloqueo previo evitó una generación que nunca llegó a ejecutarse, así que
        se valora con el coste medio por petición observado en este rango (
        {usd(estimateBasis.avgGenerationUsd)} en {estimateBasis.generations} generaciones de
        plano, render o memoria; {usd(estimateBasis.avgIterationUsd)} en{' '}
        {estimateBasis.iterations} iteraciones, que es lo que se aplica a las instrucciones de
        cambio bloqueadas). Es una estimación, no un gasto registrado. Solo se cuentan los
        bloqueos que cortaron una generación de pago: los informativos van aparte.
      </p>

      {savings.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">
          Ninguna puerta previa cortó una generación de pago en este rango: no hay ahorro que
          estimar.
        </p>
      ) : (
        <ul className="mt-4 space-y-2 text-sm">
          {savings.map((row) => (
            <li key={row.checkpoint} className="flex items-center justify-between gap-3">
              <span>
                {checkpointLabel(row.checkpoint)} · {row.blocked} bloqueos ×{' '}
                {usd(row.avgGenerationUsd)}
              </span>
              <span className="font-medium">{usd(row.avoidedUsd)}</span>
            </li>
          ))}
        </ul>
      )}

      {informative.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-medium">Bloqueos informativos (no cortaron gasto)</h3>
          <ul className="text-muted-foreground mt-1 space-y-1 text-sm">
            {informative.map((row) => (
              <li key={row.checkpoint}>
                {checkpointLabel(row.checkpoint)} · {row.blocked} bloqueos sin acción de pago
                detrás
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-muted-foreground mt-4 text-xs">
        Reparto del gasto: cada coste cae en UNA categoría, por este orden — rehecho (hubo que
        iterarlo) &gt; bloqueado &gt; aceptado &gt; sin evaluar. Así las cuatro suman el total.
      </p>
      <dl className="mt-2 grid gap-3 sm:grid-cols-4">
        <Figure label="Aceptado" value={usd(cost.acceptedUsd)} />
        <Figure label="Bloqueado" value={usd(cost.blockedUsd)} />
        <Figure label="Rehecho" value={usd(cost.iteratedUsd)} />
        <Figure label="Sin evaluar" value={usd(cost.unscoredUsd)} />
      </dl>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <Figure label="Ahorro estimado" value={usd(cost.avoidedUsd)} />
        <Figure label="Coste de Jev" value={usd(cost.jevCostUsd)} />
        <Figure
          label="Balance (ahorro − Jev)"
          value={usd(cost.balanceUsd)}
          tone={cost.balanceUsd >= 0 ? 'text-emerald-600' : 'text-rose-600'}
        />
      </dl>
    </section>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-card border-line bg-surface-muted border p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={`mt-1 text-lg font-semibold ${tone ?? ''}`}>{value}</dd>
    </div>
  );
}
