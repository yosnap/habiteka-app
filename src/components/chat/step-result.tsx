'use client';

/**
 * Paso 6: vista previa de TODO lo generado en este turno (render, plano y memoria)
 * sin salir del asistente, más el aviso de dónde queda guardado. Si se entra ya en
 * fase de feedback (recarga posterior), no hay entregables en memoria: se muestra
 * solo el aviso con el enlace.
 */
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { MaterialsMemo } from '@/components/deliverables/materials-memo';
import { Button } from '@/components/ui/button';
import { StepHeading } from './step-layout';
import { deliverablesHref } from './wizard-steps';
import type { Deliverable } from '@/lib/contracts';

// El visor de plano usa Konva: solo en cliente.
const Plan2dViewer = dynamic(
  () => import('@/components/deliverables/plan2d-viewer').then((m) => m.Plan2dViewer),
  { ssr: false },
);

interface Props {
  projectId: string;
  zoneId: string | null;
  deliverables: Deliverable[] | null;
  pending: boolean;
  /** Vuelve a la cualificación (paso 3) para generar otra variante. */
  onNewVariant: () => void;
}

export function StepResult({ projectId, zoneId, deliverables, pending, onNewVariant }: Props) {
  const items = deliverables ?? [];
  return (
    <div className="flex flex-col gap-4">
      <StepHeading step={6}>
        {items.length > 0
          ? 'Esto es lo que he preparado para ti. Échale un vistazo aquí mismo.'
          : 'Tus diseños de esta zona ya están generados.'}
      </StepHeading>

      <div className="border-brand-200 bg-brand-50 rounded-card border p-3 text-sm">
        <p className="text-ink font-semibold">Todo queda guardado en la pestaña «Diseños»</p>
        <p className="text-ink-soft">
          Desde allí puedes descargarlo, pedir cambios escribiendo lo que quieres ajustar o generar
          una variante.
        </p>
        <Link
          href={deliverablesHref(projectId, zoneId)}
          className="text-brand-700 mt-1 inline-block text-sm font-medium underline"
        >
          Ir a «Diseños» →
        </Link>
      </div>

      {items.map((d) => (
        <section key={d.id} className="flex flex-col gap-1" aria-label={`Diseño ${d.type}`}>
          {d.payload.type === 'render3d' ? (
            <>
              <h3 className="text-ink text-sm font-semibold">Render 3D</h3>
              {/* eslint-disable-next-line @next/next/no-img-element -- URL prefirmada de storage, no servida por Next */}
              <img
                src={d.payload.assetUrl}
                alt="Render 3D de tu espacio"
                className="rounded-card w-full object-contain"
              />
            </>
          ) : null}
          {d.payload.type === 'plano2d' ? (
            <>
              <h3 className="text-ink text-sm font-semibold">Plano 2D</h3>
              <Plan2dViewer plano={d.payload.plano} width={520} height={340} />
            </>
          ) : null}
          {d.payload.type === 'memoria' ? (
            <>
              <h3 className="text-ink text-sm font-semibold">Memoria de materiales</h3>
              <MaterialsMemo markdown={d.payload.markdown} />
            </>
          ) : null}
        </section>
      ))}

      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={onNewVariant}
        disabled={pending}
      >
        Crear otra variante
      </Button>
    </div>
  );
}
