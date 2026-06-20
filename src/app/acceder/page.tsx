/**
 * Acceso (login). El formulario real se monta en F-U3; por ahora la página existe
 * para que los CTA de la landing no lleven a un 404 y para el acceso de desarrollo.
 */
import Link from 'next/link';

const devLoginEnabled =
  process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_LOGIN === 'true';

export const metadata = { title: 'Acceder — Habiteka' };

export default function AccederPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-ink text-2xl font-semibold tracking-tight">Acceder</h1>
      <p className="text-ink-soft text-sm">
        El inicio de sesión estará disponible muy pronto. Mientras tanto, puedes explorar la
        herramienta en modo desarrollo.
      </p>
      {devLoginEnabled ? (
        <a
          href="/api/dev/login"
          className="bg-brand-500 rounded-[var(--radius-control)] px-4 py-2 text-sm text-white"
        >
          Entrar como admin (dev)
        </a>
      ) : null}
      <Link href="/" className="text-ink-soft text-xs underline">
        Volver al inicio
      </Link>
    </main>
  );
}
