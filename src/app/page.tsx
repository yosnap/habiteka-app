import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/server/auth/auth';

const devLoginEnabled =
  process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_LOGIN === 'true';

// Enlaces de navegación para explorar la app una vez dentro (modo desarrollo).
const NAV = [
  { href: '/users', label: 'Back-office · Usuarios' },
  { href: '/config/models', label: 'Config · Modelos de IA' },
  { href: '/config/system', label: 'Config · Ajustes' },
  { href: '/config/products', label: 'Config · Productos (Polar)' },
  { href: '/media', label: 'Media' },
  { href: '/analytics', label: 'Analítica' },
  { href: '/billing', label: 'Facturación' },
];

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as { name?: string; role?: string | null } | undefined;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Habiteka</h1>
      <p className="text-muted-foreground">Diseño, reformas e interiorismo inteligente.</p>

      {user ? (
        <>
          <p className="text-sm">
            Sesión activa como <strong>{user.name}</strong>
            {user.role === 'admin' ? ' · admin' : ''}.
          </p>
          <nav className="flex w-full flex-col gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="border-line hover:bg-surface-muted rounded-[var(--radius-control)] border px-3 py-2 text-sm"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <Link href="/api/auth/sign-out" className="text-muted-foreground text-xs underline">
            Cerrar sesión
          </Link>
        </>
      ) : devLoginEnabled ? (
        <a
          href="/api/dev/login"
          className="bg-brand-500 rounded-[var(--radius-control)] px-4 py-2 text-sm text-white"
        >
          Entrar como admin (modo desarrollo)
        </a>
      ) : (
        <p className="text-muted-foreground text-sm">Inicia sesión para empezar.</p>
      )}
    </main>
  );
}
