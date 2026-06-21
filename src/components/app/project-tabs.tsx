'use client';

/**
 * Barra de navegación entre las vistas de un proyecto (asistente, lienzo,
 * diseños). Resalta la pestaña activa según la ruta. Es la costura que conecta las
 * tres pantallas, que antes existían pero estaban aisladas.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Props {
  projectId: string;
  title: string;
}

export function ProjectTabs({ projectId, title }: Props) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  const tabs = [
    { href: `${base}/chat`, label: 'Asistente' },
    { href: base, label: 'Plano', exact: true },
    { href: `${base}/deliverables`, label: 'Diseños' },
    { href: `${base}/historial`, label: 'Historial' },
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
            const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
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
