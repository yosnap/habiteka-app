/**
 * Panel de navegación de DESARROLLO. No es UI de producto: concentra los accesos
 * al back-office y al canvas de muestra para poder explorar la app en local sin
 * montar OAuth. Se muestra solo con sesión activa o con el dev-login habilitado.
 */
import Link from 'next/link';

const NAV = [
  { href: '/users', label: 'Back-office · Usuarios' },
  { href: '/config/models', label: 'Config · Modelos de IA' },
  { href: '/config/system', label: 'Config · Ajustes' },
  { href: '/config/products', label: 'Config · Productos (Polar)' },
  { href: '/media', label: 'Media' },
  { href: '/analytics', label: 'Analítica' },
  { href: '/billing', label: 'Facturación' },
];

interface Props {
  userName?: string;
  isAdmin?: boolean;
  canvasProjectId?: string | null;
}

export function DevNavPanel({ userName, isAdmin, canvasProjectId }: Props) {
  return (
    <section className="border-line bg-surface-muted mx-auto mt-10 w-full max-w-md rounded-[var(--radius-card)] border p-5">
      <p className="text-ink-soft mb-3 text-xs font-medium tracking-wide uppercase">
        Modo desarrollo
      </p>
      {userName ? (
        <p className="text-ink mb-3 text-sm">
          Sesión activa como <strong>{userName}</strong>
          {isAdmin ? ' · admin' : ''}.
        </p>
      ) : null}
      <nav className="flex w-full flex-col gap-1">
        {canvasProjectId ? (
          <Link
            href={`/projects/${canvasProjectId}`}
            className="bg-brand-500 rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium text-white"
          >
            🎨 Abrir el canvas (proyecto de muestra)
          </Link>
        ) : null}
        <Link
          href="/proyectos"
          className="border-brand-500 text-brand-700 hover:bg-brand-50 rounded-[var(--radius-control)] border px-3 py-2 text-sm font-medium"
        >
          📁 Mis proyectos (frontend de usuario)
        </Link>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="border-line hover:bg-surface rounded-[var(--radius-control)] border px-3 py-2 text-sm"
          >
            {n.label}
          </Link>
        ))}
      </nav>
      {userName ? (
        <Link
          href="/api/auth/sign-out"
          className="text-ink-soft mt-3 inline-block text-xs underline"
        >
          Cerrar sesión
        </Link>
      ) : (
        <a
          href="/api/dev/login"
          className="bg-brand-500 mt-1 inline-block rounded-[var(--radius-control)] px-4 py-2 text-sm text-white"
        >
          Entrar como admin (dev)
        </a>
      )}
    </section>
  );
}
