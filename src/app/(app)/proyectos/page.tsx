/**
 * "Mis proyectos": lista los proyectos de la organización del usuario y permite
 * crear uno nuevo (que abre directamente su canvas). El layout (app) ya garantizó
 * la sesión; aquí solo se listan los datos con ámbito.
 */
import Link from 'next/link';
import { listProjects } from '@/server/actions/projects';
import { Card } from '@/components/ui/card';
import { NewProjectButton } from '@/components/app/new-project-button';

export const metadata = { title: 'Mis proyectos — Habiteka' };

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(d);
}

export default async function ProyectosPage() {
  const projects = await listProjects();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-ink text-2xl font-semibold tracking-tight">Mis proyectos</h1>
        <NewProjectButton />
      </div>

      {projects.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <p className="text-ink font-medium">Aún no tienes proyectos</p>
          <p className="text-ink-soft max-w-md text-sm">
            Crea tu primer proyecto, sube una foto o un boceto de tu espacio y deja que el asistente
            te ayude a diseñarlo.
          </p>
          <NewProjectButton />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}/chat`}>
              <Card className="hover:border-brand-500 h-full p-5 transition-colors">
                <h2 className="text-ink mb-1 font-medium">{p.title}</h2>
                <p className="text-ink-soft text-xs">Creado el {formatDate(p.createdAt)}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
