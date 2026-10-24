import { Bot, DraftingCompass, History, Images, LayoutTemplate, Clapperboard } from 'lucide-react';

/** Destinos compartidos entre las pestañas y el menú del editor. */
export function projectSections(projectId: string, zona?: string | null) {
  const base = `/projects/${encodeURIComponent(projectId)}`;
  const suffix = zona ? `?zona=${encodeURIComponent(zona)}` : '';
  return [
    { path: `${base}/chat`, href: `${base}/chat${suffix}`, label: 'Asistente', icon: Bot, color: 'text-violet-600' },
    { path: `${base}/plano`, href: `${base}/plano`, label: 'Plano', icon: LayoutTemplate, color: 'text-sky-600' },
    { path: base, href: `${base}${suffix}`, label: 'Editor', exact: true, icon: DraftingCompass, color: 'text-emerald-600' },
    { path: `${base}/deliverables`, href: `${base}/deliverables${suffix}`, label: 'Diseños', icon: Images, color: 'text-amber-600' },
    { path: `${base}/videos`, href: `${base}/videos${suffix}`, label: 'Vídeos', icon: Clapperboard, color: 'text-rose-600' },
    { path: `${base}/historial`, href: `${base}/historial${suffix}`, label: 'Historial', icon: History, color: 'text-ink-soft' },
  ];
}

export function isProjectSectionActive(pathname: string, section: { path: string; exact?: boolean }) {
  return section.exact ? pathname === section.path || pathname === `${section.path}/editor`
    : pathname === section.path || pathname.startsWith(`${section.path}/`);
}
