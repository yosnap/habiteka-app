'use client';

/**
 * Selector de zonas del proyecto (multi-zona). Muestra el plano por defecto
 * ("Principal") y las zonas como chips; al elegir una navega a `?zona=<id>` para
 * que la página cargue su plano. Permite crear una zona nueva.
 *
 * Para un proyecto sin zonas se ve solo "Principal" + el botón de añadir: la
 * complejidad multi-zona no aparece hasta que el usuario crea la primera zona.
 */
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import { createZone } from '@/app/(app)/projects/[id]/_actions/zone-actions';

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

  const go = (zoneId: string | null) => {
    const url = zoneId ? `/projects/${projectId}?zona=${zoneId}` : `/projects/${projectId}`;
    router.push(url);
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

  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Zonas del proyecto">
      <Chip label="Principal" active={activeZoneId === null} onClick={() => go(null)} />
      {zones.map((z) => (
        <Chip key={z.id} label={z.name} active={activeZoneId === z.id} onClick={() => go(z.id)} />
      ))}

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
