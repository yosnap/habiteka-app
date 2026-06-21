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
    <div className="flex flex-1 flex-col">
      <ProjectTabs projectId={id} title={project.title} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
