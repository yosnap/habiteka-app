/**
 * Página de acceso: cabecera de la landing + panel de login (cliente). El acceso
 * de desarrollo se mantiene como atajo discreto en local.
 */
import Link from 'next/link';
import { LandingHeader } from '@/components/landing/landing-header';
import { AccesoPanel } from '@/components/auth/acceso-panel';

const devLoginEnabled =
  process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_LOGIN === 'true';

export const metadata = { title: 'Acceder — Habiteka' };

export default function AccederPage() {
  return (
    <>
      <LandingHeader />
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12">
        <AccesoPanel />
        {devLoginEnabled ? (
          <a href="/api/dev/login" className="text-ink-soft text-xs underline">
            Entrar como admin (modo desarrollo)
          </a>
        ) : null}
        <Link href="/" className="text-ink-soft text-xs underline">
          Volver al inicio
        </Link>
      </main>
    </>
  );
}
