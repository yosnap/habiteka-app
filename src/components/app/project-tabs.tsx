'use client';

/**
 * Barra de navegación entre las vistas de un proyecto (asistente, lienzo,
 * diseños). Resalta la pestaña activa según la ruta. Es la costura que conecta las
 * tres pantallas, que antes existían pero estaban aisladas.
 */
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

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
  const suffix = zona ? `?zona=${zona}` : '';

  // `path` es la ruta sin query (para resaltar la pestaña activa); `href` lleva la zona.
  const tabs = [
    { path: `${base}/chat`, href: `${base}/chat${suffix}`, label: 'Asistente' },
    { path: base, href: `${base}${suffix}`, label: 'Plano', exact: true },
    { path: `${base}/deliverables`, href: `${base}/deliverables${suffix}`, label: 'Diseños' },
    { path: `${base}/historial`, href: `${base}/historial${suffix}`, label: 'Historial' },
  ];

  return (
    <div className="border-line bg-surface border-b">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-1 px-4">
        <Link href="/proyectos" className="text-ink-soft hover:text-ink mr-2 text-sm">
          ← Proyectos
        </Link>
        <span className="text-ink mr-4 truncate text-sm font-medium">{title}</span>
        <nav className="flex gap-1">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.path : pathname.startsWith(t.path);
            return (
              <Link
                key={t.path}
                href={t.href}
                className={cn(
                  'border-b-2 px-3 py-3 text-sm transition-colors',
                  active
                    ? 'border-brand-500 text-ink font-medium'
                    : 'text-ink-soft hover:text-ink border-transparent',
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
