/**
 * Layout común de un proyecto: valida la pertenencia una vez y monta la barra de
 * navegación entre las vistas (asistente, lienzo, diseños). Las páginas hijas se
 * centran en su contenido y comparten esta cabecera de navegación.
 */
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { requireOrgContext } from '@/server/auth/require-org-context';
import { withOrg } from '@/server/db/scoped-repo';
import { ProjectTabs } from '@/components/app/project-tabs';

interface Props {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectLayout({ children, params }: Props) {
  const { id } = await params;
  const ctx = await requireOrgContext();
  const project = await withOrg(ctx).projects.findById(id);
  if (!project) notFound();

  return (
    // `min-h-0` en los dos niveles: sin él, un hijo alto (el editor a pantalla
    // completa) fuerza a este flex a crecer más allá del hueco disponible bajo
    // la cabecera y las pestañas, y la página entera gana scroll. Con él, cada
    // hijo recibe exactamente el hueco restante y decide su propio overflow.
    <div className="flex min-h-0 flex-1 flex-col">
      <ProjectTabs projectId={id} title={project.title} />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
