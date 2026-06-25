'use client';

/**
 * Selector de zonas del proyecto (multi-zona). Muestra el plano por defecto
 * ("Principal") y las zonas como chips; al elegir una navega a `?zona=<id>` para
 * que la página cargue su plano. Permite crear, renombrar y borrar zonas, y una
 * Papelera para restaurar o borrar definitivamente las borradas (soft-delete).
 *
 * Para un proyecto sin zonas se ve solo "Principal" + el botón de añadir: la
 * complejidad multi-zona no aparece hasta que el usuario crea la primera zona.
 * "Principal" no tiene menú (no es una zona, es el plano sin zona).
 */
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import {
  createZone,
  renameZone,
  deleteZone,
} from '@/app/(app)/projects/[id]/_actions/zone-actions';
import { ZoneTrash } from './zone-trash';

interface ZoneChip {
  id: string;
  name: string;
}

export function ZoneSwitcher({
  projectId,
  zones,
  activeZoneId,
}: {
  projectId: string;
  zones: ZoneChip[];
  activeZoneId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showTrash, setShowTrash] = useState(false);

  const go = (zoneId: string | null) => {
    const url = zoneId ? `/projects/${projectId}?zona=${zoneId}` : `/projects/${projectId}`;
    router.push(url);
    // Re-ejecuta el Server Component para traer el plano de la zona destino (evita
    // servir el doc cacheado de la zona anterior).
    router.refresh();
  };

  const submitNew = () => {
    const clean = name.trim();
    if (!clean) return;
    startTransition(async () => {
      const zone = await createZone(projectId, clean);
      setName('');
      setAdding(false);
      router.push(`/projects/${projectId}?zona=${zone.id}`);
      router.refresh();
    });
  };

  const submitRename = (zoneId: string) => {
    const clean = renameValue.trim();
    if (!clean) return;
    startTransition(async () => {
      await renameZone(projectId, zoneId, clean);
      setRenamingId(null);
      router.refresh();
    });
  };

  const remove = (zone: ZoneChip) => {
    if (!window.confirm(`¿Mover "${zone.name}" a la papelera? Podrás restaurarla.`)) return;
    startTransition(async () => {
      await deleteZone(projectId, zone.id);
      // Si se borró la zona activa, volver a Principal para no quedar en una URL muerta.
      if (activeZoneId === zone.id) router.push(`/projects/${projectId}`);
      router.refresh();
    });
  };

  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Zonas del proyecto">
      <Chip label="Principal" active={activeZoneId === null} onClick={() => go(null)} />

      {zones.map((z) =>
        renamingId === z.id ? (
          <span key={z.id} className="flex items-center gap-1">
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename(z.id);
                if (e.key === 'Escape') setRenamingId(null);
              }}
              maxLength={80}
              aria-label={`Nuevo nombre de ${z.name}`}
              className="border-line rounded-control bg-surface text-ink px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => submitRename(z.id)}
              disabled={pending || !renameValue.trim()}
              className="rounded-control bg-brand-500 px-2 py-1 text-sm text-white disabled:opacity-50"
            >
              Guardar
            </button>
          </span>
        ) : (
          <span key={z.id} className="group relative inline-flex items-center">
            <Chip label={z.name} active={activeZoneId === z.id} onClick={() => go(z.id)} />
            <span className="ml-1 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => {
                  setRenameValue(z.name);
                  setRenamingId(z.id);
                }}
                aria-label={`Renombrar ${z.name}`}
                title="Renombrar"
                className="text-ink-soft hover:text-ink rounded-control px-1 text-xs"
              >
                ✎
              </button>
              <button
                type="button"
                onClick={() => remove(z)}
                disabled={pending}
                aria-label={`Borrar ${z.name}`}
                title="Mover a la papelera"
                className="text-ink-soft hover:text-[--color-danger] rounded-control px-1 text-xs disabled:opacity-50"
              >
                🗑
              </button>
            </span>
          </span>
        ),
      )}

      {adding ? (
        <span className="flex items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNew();
              if (e.key === 'Escape') setAdding(false);
            }}
            placeholder="Nombre de la zona"
            maxLength={80}
            className="border-line rounded-control bg-surface text-ink px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={submitNew}
            disabled={pending || !name.trim()}
            className="rounded-control bg-brand-500 px-2 py-1 text-sm text-white disabled:opacity-50"
          >
            Añadir
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="border-line text-ink-soft hover:text-ink rounded-control border border-dashed px-3 py-1 text-sm"
        >
          + Zona
        </button>
      )}

      <button
        type="button"
        onClick={() => setShowTrash(true)}
        className="text-ink-soft hover:text-ink rounded-control px-2 py-1 text-sm"
        title="Papelera de zonas"
      >
        🗑 Papelera
      </button>

      {showTrash ? (
        <ZoneTrash
          projectId={projectId}
          activeZoneId={activeZoneId}
          onClose={() => setShowTrash(false)}
        />
      ) : null}
    </nav>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-control px-3 py-1 text-sm transition-colors',
        active ? 'bg-brand-500 text-white' : 'border-line text-ink-soft hover:text-ink border',
      )}
    >
      {label}
    </button>
  );
}
