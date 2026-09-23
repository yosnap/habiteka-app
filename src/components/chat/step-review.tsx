'use client';

/**
 * Paso 5: detalles opcionales, resumen de lo elegido y confirmación. Aquí vive el
 * gate de Términos, el estado de generación (el render tarda) y el error con
 * reintento: si la generación falla, la fase NO avanza y el usuario puede repetir
 * sin recargar.
 */
import Image from 'next/image';
import { TosAcceptanceNotice } from '@/components/legal/tos-acceptance';
import { Button } from '@/components/ui/button';
import { ENTREGABLES, ESTILOS, estiloDescripcion, estiloLabel } from '@/lib/design-options';
import { StepHeading, StepNav } from './step-layout';
import { missingForGenerate } from './wizard-steps';
import type { DeliverableType, Estilo } from '@/lib/contracts';

interface Props {
  estilo?: Estilo;
  entregables: DeliverableType[];
  objetivo: string;
  onObjetivoChange: (value: string) => void;
  tosAccepted: boolean | null;
  onAcceptTos: () => void;
  generating: boolean;
  pending: boolean;
  error: string | null;
  onGenerate: () => void;
  onBack: () => void;
}

const MAX_OBJETIVO = 600;

export function StepReview({
  estilo,
  entregables,
  objetivo,
  onObjetivoChange,
  tosAccepted,
  onAcceptTos,
  generating,
  pending,
  error,
  onGenerate,
  onBack,
}: Props) {
  const missing = missingForGenerate({ estilo, entregables }, tosAccepted);
  const labels = entregables.map((v) => ENTREGABLES.find((o) => o.value === v)?.label ?? v);
  const thumb = estilo ? ESTILOS.find((o) => o.value === estilo)?.image : undefined;

  return (
    <div className="flex flex-col gap-4">
      <StepHeading step={5}>
        Última revisión. Si quieres, añade lo que tengo que tener en cuenta (colores, presupuesto,
        quién usa la estancia…) y genero tus diseños.
      </StepHeading>

      <label className="flex flex-col gap-1">
        <span className="text-ink text-sm font-medium">¿Algo más que deba saber? (opcional)</span>
        <textarea
          value={objetivo}
          maxLength={MAX_OBJETIVO}
          rows={3}
          disabled={pending || generating}
          onChange={(e) => onObjetivoChange(e.target.value)}
          placeholder="Ej.: tonos cálidos, presupuesto ajustado, hay un niño pequeño…"
          className="border-line bg-surface text-ink rounded-control border px-3 py-2 text-sm"
        />
      </label>

      <section className="border-line bg-surface-muted flex gap-3 rounded-card border p-3">
        {thumb && estilo ? (
          <Image
            src={thumb}
            alt={`Estilo ${estiloLabel(estilo)}`}
            width={160}
            height={120}
            className="rounded-control h-20 w-28 shrink-0 object-cover"
          />
        ) : null}
        <div className="flex flex-col gap-0.5 text-sm">
          <p className="text-ink font-semibold">
            {estilo ? estiloLabel(estilo) : 'Sin estilo elegido'}
          </p>
          {estilo ? <p className="text-ink-soft text-xs">{estiloDescripcion(estilo)}</p> : null}
          <p className="text-ink-soft text-xs">
            Vas a recibir: {labels.length > 0 ? labels.join(', ') : 'nada seleccionado todavía'}.
          </p>
        </div>
      </section>

      <TosAcceptanceNotice
        accepted={tosAccepted}
        onAccept={onAcceptTos}
        disabled={pending || generating}
      />

      {generating ? (
        <div className="border-brand-200 bg-brand-50 rounded-control flex items-start gap-2 border p-3 text-sm">
          <span className="border-brand-500 mt-0.5 inline-block size-3 shrink-0 animate-spin rounded-full border-2 border-t-transparent" />
          <span className="text-ink">
            Generando tus diseños… El render puede tardar hasta ~2 minutos. No cierres esta pestaña;
            te aviso aquí cuando esté listo (o si algo falla).
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-control flex flex-col gap-2 border border-red-300 bg-red-50 p-3 text-sm">
          <p className="text-red-700">No se pudieron generar los diseños: {error}</p>
          <Button type="button" size="sm" onClick={onGenerate} disabled={pending || generating}>
            Reintentar
          </Button>
        </div>
      ) : null}

      <StepNav
        onBack={onBack}
        onNext={onGenerate}
        nextLabel="🎨 Generar mis diseños"
        disabled={pending || generating}
        nextDisabled={missing !== null}
        hint={missing}
      />
    </div>
  );
}
