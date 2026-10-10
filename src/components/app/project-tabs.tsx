'use client';

/** Navegación flotante compartida; el editor incorpora la suya junto a la planta. */
import { usePathname, useSearchParams } from 'next/navigation';
import { projectSections, isProjectSectionActive } from './project-sections';
import { ProjectNavigationMenu } from '@/components/editor-v2/project-navigation-menu';
import ui from './project-tabs.module.css';

interface Props {
  projectId: string;
  title: string;
}

export function ProjectTabs({ projectId, title }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Conserva la zona activa al navegar entre pestañas: el trabajo (asistente, plano,
  // diseños) es por zona, así que cambiar de pestaña no debe perder la zona seleccionada.
  const zona = searchParams.get('zona');
  const tabs = projectSections(projectId, zona);
  // El lienzo incorpora su navegación en el flotante del proyecto.
  if (tabs.some((tab) => tab.exact && isProjectSectionActive(pathname, tab))) return null;
  const hasRail = tabs.some(tab => ['Plano', 'Diseños', 'Vídeos'].includes(tab.label) && isProjectSectionActive(pathname, tab));

  return (
    <div className={`${ui.dock} ${hasRail ? ui.withRail : ''}`}>
      <header className={ui.bar} aria-label="Proyecto y navegación">
        <strong className={ui.title} title={title}>{title}</strong>
        <ProjectNavigationMenu projectId={projectId} zoneId={zona} projectName={title} />
      </header>
      <div className={ui.tools} data-project-floating-tools />
    </div>
  );
}
