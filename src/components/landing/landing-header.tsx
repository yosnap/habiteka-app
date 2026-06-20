/**
 * Cabecera pública de la landing: marca + accesos a registro/login.
 */
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function LandingHeader() {
  return (
    <header className="border-line bg-surface/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-ink text-lg font-semibold tracking-tight">
          Habiteka
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link href="/acceder">Acceder</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/registro">Empezar gratis</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
