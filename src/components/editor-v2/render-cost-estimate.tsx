'use client';
import { useState } from 'react';
import { useMountEffect } from '@/lib/use-mount-effect';

type Estimate = { estimatedUsd: number; model: string };

/**
 * Coste estimado del lote antes de generar. Se monta con `key` = número de
 * generaciones, así que cada cambio de vistas, estancias o zonas vuelve a
 * preguntar el precio sin efectos que dependan de props.
 */
export function RenderCostEstimate({ passes, zoneComposite, estimate }: {
  passes: number;
  zoneComposite: boolean;
  estimate: (passes: number) => Promise<Estimate>;
}) {
  const [state, setState] = useState<{ value?: Estimate; error?: string }>({});
  useMountEffect(() => {
    let active = true;
    estimate(passes).then((value) => { if (active) setState({ value }); },
      (cause: unknown) => { if (active) setState({ error: cause instanceof Error && cause.message ? cause.message : 'No se pudo estimar el coste de este lote.' }); });
    return () => { active = false; };
  });
  if (state.error) return <p className="text-ink-soft mt-2">{state.error}</p>;
  if (!state.value) return <p className="text-ink-soft mt-2">Calculando el coste…</p>;
  const usd = state.value.estimatedUsd.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <p className="text-ink mt-2">
      Coste estimado: {zoneComposite ? 'hasta ' : ''}{usd} $ · {passes} {passes === 1 ? 'generación' : 'generaciones'}
      {zoneComposite && ' (2 por vista por las zonas; si la zona no se ve en una vista, esa paga solo una)'}.
    </p>
  );
}

export default RenderCostEstimate;
