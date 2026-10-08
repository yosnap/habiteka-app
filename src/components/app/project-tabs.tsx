'use client';

/**
 * Barra de navegación entre las vistas de un proyecto (asistente, lienzo,
 * diseños). Resalta la pestaña activa según la ruta. Es la costura que conecta las
 * tres pantallas, que antes existían pero estaban aisladas.
 */
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ArrowLeft, Bot, DraftingCompass, History, Images, LayoutTemplate, Clapperboard } from 'lucide-react';

interface Props {
  projectId: string;
  title: string;
}

export function ProjectTabs({ projectId, title }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const base = `/projects/${projectId}`;
  // Conserva la zona activa al navegar entre pestañas: el trabajo (asistente, plano,
  // diseños) es por zona, así que cambiar de pestaña no debe perder la zona seleccionada.
  const zona = searchParams.get('zona');
  const suffix = zona ? `?zona=${encodeURIComponent(zona)}` : '';

  // `path` es la ruta sin query (para resaltar la pestaña activa); `href` lleva la zona.
  // La raíz es el canvas v2. "Plano" conserva el flujo de boceto → plano → cenital.
  const tabs = [
    { path: `${base}/chat`, href: `${base}/chat${suffix}`, label: 'Asistente', icon: Bot, color: 'text-violet-600' },
    { path: `${base}/plano`, href: `${base}/plano`, label: 'Plano', icon: LayoutTemplate, color: 'text-sky-600' },
    { path: base, href: `${base}${suffix}`, label: 'Editor', exact: true, icon: DraftingCompass, color: 'text-emerald-600' },
    { path: `${base}/deliverables`, href: `${base}/deliverables${suffix}`, label: 'Diseños', icon: Images, color: 'text-amber-600' },
    { path: `${base}/videos`, href: `${base}/videos${suffix}`, label: 'Vídeos', icon: Clapperboard, color: 'text-rose-600' },
    { path: `${base}/historial`, href: `${base}/historial${suffix}`, label: 'Historial', icon: History, color: 'text-ink-soft' },
  ];

  return (
    <div className="border-line bg-surface border-b">
      <div className="flex w-full flex-wrap items-center gap-3 px-4 py-2">
        <Link href="/proyectos" title="Volver a mis proyectos" aria-label="Volver a mis proyectos" className="text-ink-soft hover:text-ink grid size-9 place-items-center rounded-xl border border-line hover:bg-surface-muted">
          <ArrowLeft size={17} />
        </Link>
        <span className="text-ink mr-2 max-w-40 truncate text-sm font-semibold">{title}</span>
        <nav aria-label="Secciones del proyecto" className="flex w-full min-w-0 gap-1 overflow-x-auto rounded-2xl bg-surface-muted p-1 sm:w-auto">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.path || pathname === `${base}/editor` : pathname.startsWith(t.path);
            return (
              <Link
                key={t.path}
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-brand-500',
                  active
                    ? 'bg-surface text-ink font-semibold shadow-sm'
                    : 'text-ink-soft hover:text-ink hover:bg-surface',
                )}
              >
                <t.icon size={17} className={t.color} aria-hidden="true" />{t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
