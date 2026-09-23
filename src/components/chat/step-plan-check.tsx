'use client';

/**
 * Paso 2 de la ruta del plano: «Revisa tu plano».
 *
 * Aquí se ve lo que se ha leído (no la imagen original: el plano reconstruido) y
 * el veredicto de fiabilidad de Jev, que decide qué se puede hacer después. Si la
 * lectura es mala, todo lo que venga detrás saldría mal, así que la única salida
 * es corregir el plano en el editor.
 */
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { PlanQualityCard } from '@/components/plano-studio/plan-quality-card';
import { applyPlanQuality } from '@/lib/plan-quality';
import { StepHeading } from './step-layout';
import type { PlanImportResult } from '@/lib/contracts';
import type { StudioQuality } from '@/lib/studio-state';

// El visor de plano usa Konva: solo en cliente.
const Plan2dViewer = dynamic(
  () => import('@/components/deliverables/plan2d-viewer').then((m) => m.Plan2dViewer),
  { ssr: false },
);

interface Props {
  result: PlanImportResult;
  quality: StudioQuality;
  /** Confirmación en dos pasos del reemplazo del plano del proyecto. */
  confirmApply: boolean;
  pending: boolean;
  applying: boolean;
  error: string | null;
  onApply: () => void;
  onCancelApply: () => void;
  onRetryUpload: () => void;
}

export function StepPlanCheck({
  result,
  quality,
  confirmApply,
  pending,
  applying,
  error,
  onApply,
  onCancelApply,
  onRetryUpload,
}: Props) {
  // Misma regla que aguas abajo: solo un plano que Jev da por bueno se presenta
  // como fiel; con dudas o bloqueo, el visor lo rotula como aproximado.
  const plano = useMemo(() => applyPlanQuality(result.plano, quality), [result.plano, quality]);
  const estancias = result.writtenDimensions.length;

  return (
    <div className="flex flex-col gap-4">
      <StepHeading step={2} intent="plan">
        Esto es lo que he leído de tu plano. Compruébalo antes de seguir: si la lectura no es
        fiel, el 3D y los diseños que hagamos después heredarán el error.
      </StepHeading>

      <div className="border-line bg-surface rounded-card border p-2">
        <Plan2dViewer plano={plano} width={560} height={380} />
      </div>

      <p className="text-ink-soft text-xs">
        He reconocido {estancias} {estancias === 1 ? 'estancia' : 'estancias'}
        {result.escalaEstimada
          ? '. No he encontrado cotas legibles, así que la escala es una estimación: revísala en el editor.'
          : '. Las medidas se han ajustado a las cotas escritas en el plano.'}
      </p>

      {result.warnings.length > 0 ? (
        <ul className="rounded-control border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          {result.warnings.slice(0, 6).map((warning) => (
            <li key={`${warning.code}-${warning.zoneId ?? ''}-${warning.message}`}>
              {warning.message}
            </li>
          ))}
        </ul>
      ) : null}

      <PlanQualityCard
        quality={quality}
        confirmApply={confirmApply}
        busy={pending || applying}
        applying={applying}
        onApply={onApply}
        onCancel={onCancelApply}
      />

      <button
        type="button"
        className="text-ink-soft text-xs underline"
        disabled={pending || applying}
        onClick={onRetryUpload}
      >
        Subir otro plano
      </button>

      {error ? (
        <p role="alert" className="rounded-control border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
