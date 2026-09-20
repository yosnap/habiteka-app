import type { AiCostGroup } from '@/server/analytics/ai-cost-queries';

export function AiCostTimeline({ points }: { points: AiCostGroup[] }) {
  const max = Math.max(...points.map(p => p.confirmedUsd + p.estimatedUsd), 0.000001);
  return <section className="rounded-card border border-line bg-surface p-4">
    <h2 className="font-semibold">Evolución del gasto</h2>
    <p className="mt-1 text-xs text-muted-foreground">USD · Verde: confirmado · Ámbar: estimado. Los costes desconocidos no se contabilizan como cero.</p>
    <div className="mt-4 max-h-80 space-y-3 overflow-auto">
      {points.map(p => <div key={p.key} className="grid grid-cols-[6rem_1fr_10rem] items-center gap-3 text-xs">
        <span>{p.label}</span>
        <div className="flex h-5 rounded bg-surface-muted" aria-label={`${p.confirmedUsd} confirmado, ${p.estimatedUsd} estimado`}>
          <div className="h-full bg-emerald-600" style={{ width: `${p.confirmedUsd / max * 100}%` }} />
          <div className="h-full bg-amber-400" style={{ width: `${p.estimatedUsd / max * 100}%` }} />
        </div>
        <span>{(p.confirmedUsd + p.estimatedUsd).toFixed(4)} USD · {p.unknownAttempts} sin coste conocido</span>
      </div>)}
      {!points.length && <p className="text-sm text-muted-foreground">Sin actividad en el período seleccionado.</p>}
    </div>
  </section>;
}
