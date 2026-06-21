'use client';

/**
 * Tarjeta de un proyecto en «Mis proyectos»: enlaza al asistente y ofrece
 * eliminarlo (soft-delete) con confirmación. Tras borrar, refresca la lista.
 */
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { deleteProject } from '@/server/actions/projects';

interface Props {
  id: string;
  title: string;
  createdLabel: string;
  coverUrl?: string | null;
}

export function ProjectCard({ id, title, createdLabel, coverUrl }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      await deleteProject(id);
      router.refresh();
    });

  return (
    <Card className="hover:border-brand-500 relative h-full p-5 transition-colors">
      <Link href={`/projects/${id}/chat`} className="block">
        {coverUrl ? (
          // Portada: primer render del proyecto.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={`Diseño de ${title}`}
            className="border-line mb-3 h-32 w-full rounded-[var(--radius-control)] border object-cover"
          />
        ) : (
          <div className="border-line bg-surface-muted text-ink-soft mb-3 flex h-32 w-full items-center justify-center rounded-[var(--radius-control)] border border-dashed px-3 text-center text-xs">
            Aún no se han generado diseños para este proyecto
          </div>
        )}
        <h2 className="text-ink mb-1 font-medium">{title}</h2>
        <p className="text-ink-soft text-xs">Creado el {createdLabel}</p>
      </Link>
      {confirming ? (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="text-ink-soft">¿Eliminar?</span>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="text-danger underline disabled:opacity-50"
          >
            {pending ? 'Eliminando…' : 'Sí, eliminar'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-ink-soft underline"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-ink-soft hover:text-danger absolute top-3 right-3 text-xs underline"
        >
          Eliminar
        </button>
      )}
    </Card>
  );
}
