'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Check, ChevronDown } from 'lucide-react';
import { projectSections, isProjectSectionActive } from '@/components/app/project-sections';
import ui from './project-navigation-menu.module.css';

export function ProjectNavigationMenu({ projectId, zoneId, projectName }: {
  projectId?: string; zoneId?: string | null; projectName: string;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const sections = projectId ? projectSections(projectId, zoneId) : [];
  const active = sections.find(section => isProjectSectionActive(pathname, section));
  const label = active?.label ?? 'Editor';
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !menu.current?.open) return;
      menu.current.open = false;
      menu.current.querySelector('summary')?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  return <details ref={menu} className={ui.menu}>
    <summary className={ui.trigger} aria-label={`${projectName} · ${label} · Navegar por el proyecto`}>
      {active && <active.icon size={21} className={active.color} aria-hidden="true" />}<span>{label}</span><ChevronDown size={18} aria-hidden="true" />
    </summary>
    <nav className={ui.popup} aria-label="Secciones del proyecto" onClick={() => { if (menu.current) menu.current.open = false; }}>
      <p className={ui.title}>{projectName}</p>
      {projectId ? sections.map((section) => <Link key={section.path} href={section.href}
        aria-current={section === active ? 'page' : undefined} className={ui.link}>
        <section.icon size={21} className={section.color} aria-hidden="true" />{section.label}{section === active && <Check size={18} aria-hidden="true" />}
      </Link>) : <p className={ui.hint}>Muestra independiente. Abre un proyecto para acceder a su plano, asistente y diseños guardados.</p>}
      <Link href="/proyectos" className={`${ui.link} ${ui.back}`}><ArrowLeft size={21} aria-hidden="true" />Mis proyectos</Link>
    </nav>
  </details>;
}
