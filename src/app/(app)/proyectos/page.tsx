/**
 * "Mis proyectos": lista los proyectos de la organización del usuario y permite
 * crear uno nuevo (que abre directamente su canvas). El layout (app) ya garantizó
 * la sesión; aquí solo se listan los datos con ámbito.
 */
import { listProjects } from '@/server/actions/projects';
import { getProjectCovers } from '@/server/actions/project-covers';
import { Card } from '@/components/ui/card';
import { NewProjectButton } from '@/components/app/new-project-button';
import { ProjectCard } from '@/components/app/project-card';

export const metadata = { title: 'Mis proyectos — Habiteka' };

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(d);
}

export default async function ProyectosPage() {
  const projects = await listProjects();
  const covers = await getProjectCovers(projects.map((p) => p.id));

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
            <ProjectCard
              key={p.id}
              id={p.id}
              title={p.title}
              createdLabel={formatDate(p.createdAt)}
              coverUrl={covers[p.id] ?? null}
            />
          ))}
        </div>
      )}
    </main>
  );
}
