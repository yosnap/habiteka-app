'use client';

/**
 * Galería de historial "origen → diseño": por cada imagen de origen, su miniatura
 * y los diseños que produjo. Un grupo final agrupa los diseños sin imagen de origen
 * (proyectos previos a la trazabilidad). Solo lectura.
 */
import type { DeliverableType } from '@/lib/contracts';

/** Resumen de un entregable para la galería (sin payload completo). */
export interface HistoryDeliverable {
  id: string;
  type: DeliverableType;
  /** URL del render, si el entregable es de tipo render3d; null en otro caso. */
  renderUrl: string | null;
  sourceImageId: string | null;
}

/** Una imagen de origen con los diseños que produjo (o el grupo sin origen). */
export interface HistoryGroup {
  /** null en el grupo "sin imagen de origen". */
  sourceImageId: string | null;
  sourceImageUrl: string | null;
  deliverables: HistoryDeliverable[];
}

const TYPE_LABEL: Record<DeliverableType, string> = {
  plano2d: 'Plano 2D',
  render3d: 'Render',
  memoria: 'Memoria',
};

export function HistoryGallery({ groups }: { groups: HistoryGroup[] }) {
  const hasContent = groups.some((g) => g.sourceImageUrl || g.deliverables.length > 0);
  if (!hasContent) {
    return (
      <p className="text-muted-foreground p-6 text-center text-sm">
        Aún no hay historial. Sube una foto y genera un diseño para verlo aquí.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section
          key={group.sourceImageId ?? 'sin-origen'}
          aria-label={group.sourceImageId ? 'Imagen de origen y sus diseños' : 'Diseños sin origen'}
          className="border-line flex flex-col gap-3 border-b pb-4 last:border-b-0"
        >
          <HistoryOrigin url={group.sourceImageUrl} />
          {group.deliverables.length === 0 ? (
            <p className="text-muted-foreground text-xs">Sin diseños generados todavía.</p>
          ) : (
            <ul className="flex flex-wrap gap-3">
              {group.deliverables.map((d) => (
                <li key={d.id}>
                  <HistoryDeliverableCard deliverable={d} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

// Encabeza el grupo con la miniatura de origen, o un rótulo cuando no la hay.
function HistoryOrigin({ url }: { url: string | null }) {
  if (!url) {
    return <p className="text-ink text-sm font-medium">Diseños sin imagen de origen</p>;
  }
  return (
    <figure className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- URL prefirmada de storage, no servida por Next */}
      <img
        src={url}
        alt="Imagen de origen subida por el usuario"
        className="rounded-control h-20 w-20 object-cover"
      />
      <figcaption className="text-ink text-sm font-medium">Subiste esto →</figcaption>
    </figure>
  );
}

// Tarjeta de un diseño: render con miniatura; otros tipos con su rótulo.
function HistoryDeliverableCard({ deliverable }: { deliverable: HistoryDeliverable }) {
  return (
    <div className="rounded-card border-line flex w-28 flex-col items-center gap-1 border p-2">
      {deliverable.renderUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL prefirmada de storage, no servida por Next
        <img
          src={deliverable.renderUrl}
          alt="Diseño generado"
          className="rounded-control h-20 w-full object-cover"
        />
      ) : (
        <div className="rounded-control bg-surface text-muted-foreground flex h-20 w-full items-center justify-center text-xs">
          {TYPE_LABEL[deliverable.type]}
        </div>
      )}
      <span className="text-ink-soft text-xs">{TYPE_LABEL[deliverable.type]}</span>
    </div>
  );
}
