'use client';

/**
 * Puerta de calidad de la vista cenital del estudio.
 *
 * Misma regla que el editor, con la misma presentación: con fiabilidad baja el
 * botón de generar queda desactivado y se explican los motivos; con dudas (o
 * sin haber leído la geometría del plano) hace falta marcar la casilla. El
 * servidor vuelve a decidir con el veredicto guardado: esto solo evita que el
 * usuario pague por enterarse.
 */
import { QualityVerdictCard } from '@/components/quality/quality-verdict-card';
import type { StudioQuality } from '@/lib/studio-state';
import { CheckToggle } from '@/components/ui/check-toggle';

const BLOCKED_NOTE =
  'No generaremos ninguna vista con este plano: corrígelo en el editor y vuelve a intentarlo.';

const UNKNOWN: StudioQuality = {
  score: null,
  decision: 'confirm',
  reasons: ['No hemos leído la geometría de este plano, así que no podemos medir su fiabilidad.'],
  failOpen: false,
};

interface Props {
  /** Veredicto guardado del plano; sin él no hay fiabilidad que afirmar. */
  quality?: StudioQuality | null;
  ack: boolean;
  onAckChange: (value: boolean) => void;
  disabled?: boolean;
}

/** Decisión que aplicará el servidor con lo que sabe el cliente. */
export function cenitalGateDecision(quality?: StudioQuality | null): StudioQuality['decision'] {
  return (quality ?? UNKNOWN).decision;
}

/** `true` cuando el servidor no dejaría generar con el estado actual. */
export function cenitalGateBlocks(quality: StudioQuality | null | undefined, ack: boolean): boolean {
  const decision = cenitalGateDecision(quality);
  return decision === 'block' || (decision === 'confirm' && !ack);
}

export function CenitalQualityGate({ quality, ack, onAckChange, disabled = false }: Props) {
  const shown = quality ?? UNKNOWN;
  return (
    <div className="mt-3 space-y-2">
      <QualityVerdictCard quality={shown} blockedNote={BLOCKED_NOTE} />
      {shown.decision === 'confirm' ? (
        <CheckToggle checked={ack} disabled={disabled} onChange={onAckChange} label="Entiendo las dudas y quiero generar igualmente" />
      ) : null}
    </div>
  );
}

export default CenitalQualityGate;
