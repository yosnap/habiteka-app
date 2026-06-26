/**
 * CTA final de la landing: llamada a la acción con fondo destacado.
 */
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function LandingCTA() {
  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-20">
      <div className="bg-brand-500 rounded-card flex flex-col items-center gap-5 px-8 py-12 text-center text-white">
        <h2 className="text-3xl font-semibold tracking-tight">
          Empieza tu próximo proyecto hoy
        </h2>
        <p className="max-w-xl text-white/90">
          Crea una cuenta gratis, diseña tu primera sala en minutos y compártela con tu cliente.
          Sin tarjeta, sin descargas.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" variant="secondary">
            <Link href="/registro">Crear cuenta gratis</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10">
            <Link href="/acceder">Iniciar sesión</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
