'use client';

/**
 * Panel de entregables: presenta cada `Deliverable` con el visor que corresponde
 * a su tipo. El plano 2D usa un lienzo de solo lectura (con el sello dentro del
 * stage); el render y la memoria, sus visores. El sello legal acompaña a todos.
 */
import dynamic from 'next/dynamic';
import type { Deliverable } from '@/lib/contracts';
import { Render3dViewer } from './render3d-viewer';
import { MaterialsMemo } from './materials-memo';
import { DeliverableActions } from './deliverable-actions';
import { ENTREGABLES } from '@/lib/design-options';

// El visor de plano usa Konva: se carga solo en cliente.
const Plan2dViewer = dynamic(() => import('./plan2d-viewer').then((m) => m.Plan2dViewer), {
  ssr: false,
});

/** Entregable enriquecido para la vista: añade la URL de origen y la zona. */
export type DeliverableView = Deliverable & {
  /** URL de la imagen que el usuario subió y originó este diseño, si la hay. */
  sourceImageUrl: string | null;
  /** Zona que originó el diseño (multi-zona); null = plano por defecto. */
  zoneId: string | null;
};

export function DeliverablesPanel({
  deliverables,
  projectId,
}: {
  deliverables: DeliverableView[];
  projectId: string;
}) {
  if (deliverables.length === 0) {
    return (
      <p className="text-muted-foreground p-6 text-center text-sm">
        Aún no hay diseños. Completa tus preferencias en el chat para generarlos.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {deliverables.map((d) => (
        <section
          key={d.id}
          aria-label={`${typeLabel(d.type)} · versión ${d.version}`}
          className="border-line bg-surface flex flex-col gap-3 rounded-card border p-4"
        >
          <header className="flex items-center justify-between gap-2">
            <h2 className="text-ink text-base font-semibold">{typeLabel(d.type)}</h2>
            <span className="text-ink-soft text-xs">Versión {d.version}</span>
          </header>
          {d.sourceImageUrl && <SourceImageOrigin url={d.sourceImageUrl} />}
          {d.payload.type === 'plano2d' && <Plan2dViewer plano={d.payload.plano} downloadable />}
          {d.payload.type === 'render3d' && (
            <Render3dViewer assetUrl={d.payload.assetUrl} projectId={projectId} zoneId={d.zoneId} />
          )}
          {d.payload.type === 'memoria' && <MaterialsMemo markdown={d.payload.markdown} />}
          <DeliverableActions projectId={projectId} deliverable={d} />
        </section>
      ))}
    </div>
  );
}

function typeLabel(type: DeliverableView['type']): string {
  return ENTREGABLES.find((o) => o.value === type)?.label ?? type;
}

/** Miniatura de la imagen de origen sobre el diseño (trazabilidad "origen → diseño"). */
function SourceImageOrigin({ url }: { url: string }) {
  return (
    <figure className="mb-2 flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- URL prefirmada de storage, no servida por Next */}
      <img
        src={url}
        alt="Imagen de origen subida por el usuario"
        className="rounded-control h-16 w-16 object-cover"
      />
      <figcaption className="text-muted-foreground text-xs">
        Generado a partir de esta imagen
      </figcaption>
    </figure>
  );
}
