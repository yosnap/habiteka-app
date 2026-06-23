'use client';

/**
 * Papelera de zonas: panel modal que lista las zonas borradas (soft-delete) de un proyecto y
 * permite restaurarlas (vuelven con su plano e imágenes) o borrarlas definitivamente (purge,
 * irreversible). Carga la lista al abrir vía Server Action.
 */
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useMountEffect } from '@/lib/use-mount-effect';
import {
  listDeletedZones,
  restoreZone,
  purgeZone,
} from '@/app/(app)/projects/[id]/_actions/zone-actions';

interface DeletedZone {
  id: string;
  name: string;
}

export function ZoneTrash({
  projectId,
  activeZoneId,
  onClose,
}: {
  projectId: string;
  activeZoneId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [zones, setZones] = useState<DeletedZone[] | null>(null);

  const reload = () => {
    void listDeletedZones(projectId).then((rows) =>
      setZones(rows.map((r) => ({ id: r.id, name: r.name }))),
    );
  };

  useMountEffect(() => {
    reload();
  });

  const restore = (zone: DeletedZone) => {
    startTransition(async () => {
      await restoreZone(projectId, zone.id);
      reload();
      router.refresh();
    });
  };

  const purge = (zone: DeletedZone) => {
    if (!window.confirm(`¿Borrar "${zone.name}" definitivamente? Esto no se puede deshacer.`)) {
      return;
    }
    startTransition(async () => {
      await purgeZone(projectId, zone.id);
      // Si por alguna razón era la activa, volver a Principal.
      if (activeZoneId === zone.id) router.push(`/projects/${projectId}`);
      reload();
      router.refresh();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Papelera de zonas"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="bg-surface w-full max-w-md rounded-card border border-line p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-ink text-base font-medium">Papelera de zonas</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar papelera"
            className="text-ink-soft hover:text-ink"
          >
            ✕
          </button>
        </div>

        {zones === null ? (
          <p className="text-ink-soft text-sm">Cargando…</p>
        ) : zones.length === 0 ? (
          <p className="text-ink-soft text-sm">No hay zonas en la papelera.</p>
        ) : (
          <ul className="space-y-1">
            {zones.map((z) => (
              <li
                key={z.id}
                className="border-line flex items-center justify-between gap-2 rounded-control border px-2 py-1.5"
              >
                <span className="text-ink text-sm">{z.name}</span>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => restore(z)}
                    disabled={pending}
                    className="rounded-control bg-brand-500 px-2 py-1 text-xs text-white disabled:opacity-50"
                  >
                    Restaurar
                  </button>
                  <button
                    type="button"
                    onClick={() => purge(z)}
                    disabled={pending}
                    className="border-line text-ink-soft hover:text-[--color-danger] rounded-control border px-2 py-1 text-xs disabled:opacity-50"
                  >
                    Borrar definitivamente
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
