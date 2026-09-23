'use client';

/**
 * Presentación única del veredicto de fiabilidad (Jev).
 *
 * La usan tanto el estudio del plano como el diálogo de generación del editor,
 * para que la banda, el porcentaje y los motivos se lean siempre igual. No
 * decide nada: solo muestra lo que el servidor ya ha decidido.
 */
import type { QualityVerdict } from '@/lib/quality-verdict';

const BANDS = {
  proceed: { label: 'Fiabilidad alta', className: 'border-emerald-300 bg-emerald-50 text-emerald-900' },
  confirm: { label: 'Fiabilidad media', className: 'border-amber-300 bg-amber-50 text-amber-900' },
  block: { label: 'Fiabilidad baja', className: 'border-red-300 bg-red-50 text-red-900' },
} as const;

/** Banda de color de una decisión, para avisos que no son la tarjeta entera. */
export function qualityBandClassName(decision: QualityVerdict['decision']): string {
  return BANDS[decision].className;
}

interface Props {
  quality: QualityVerdict;
  /** Aviso final propio de cada flujo cuando la decisión es `block`. */
  blockedNote?: string;
  /**
   * Formato compacto para listados («Diseños»): menos relleno y como mucho dos
   * motivos, para que la calidad acompañe al diseño sin robarle la vista.
   */
  compact?: boolean;
}

export function QualityVerdictCard({ quality, blockedNote, compact = false }: Props) {
  const band = BANDS[quality.decision];
  const reasons = compact ? quality.reasons.slice(0, 2) : quality.reasons;
  return (
    <div
      role="status"
      className={`rounded-card border text-xs ${compact ? 'p-2' : 'p-3'} ${band.className}`}
    >
      <p className="font-medium">
        {band.label}
        {quality.score !== null ? `: ${quality.score} %` : ''}
      </p>
      {quality.failOpen === false && !compact ? (
        <p className="mt-1">
          No se pudo evaluar la fiabilidad automáticamente, así que hace falta que revises el
          plano y confirmes antes de seguir.
        </p>
      ) : null}
      {reasons.length > 0 ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
      {quality.decision === 'block' && blockedNote ? (
        <p className="mt-1 font-medium">{blockedNote}</p>
      ) : null}
    </div>
  );
}

export default QualityVerdictCard;
