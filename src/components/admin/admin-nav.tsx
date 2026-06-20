/**
 * Navegación lateral del back-office. Enlaces a las secciones del panel; el acceso
 * real lo controla el guardia server-side, no la presencia o ausencia de un enlace.
 */
import Link from 'next/link';

const SECTIONS: Array<{ href: string; label: string }> = [
  { href: '/users', label: 'Usuarios' },
  { href: '/config', label: 'Configuración' },
  { href: '/media', label: 'Media' },
  { href: '/analytics', label: 'Analítica' },
];

export function AdminNav() {
  return (
    <nav aria-label="Secciones de administración" className="flex flex-col gap-1">
      {SECTIONS.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className="text-ink hover:bg-surface-muted rounded-[var(--radius-control)] px-3 py-2 text-sm"
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
