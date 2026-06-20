/**
 * Hero de la landing: propuesta de valor + llamada a la acción principal.
 *
 * Tono de confianza, no de miedo: la nota "conceptual" se presenta como un valor
 * (explora sin compromiso) y la validación profesional como buena práctica, no
 * como advertencia legal disuasoria (coherente con la UX de F1).
 */
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function LandingHero() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 py-20 text-center">
      <span className="bg-brand-50 text-brand-700 rounded-full px-3 py-1 text-xs font-medium">
        Diseño de interiores asistido por IA
      </span>
      <h1 className="text-ink max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Imagina tu reforma antes de empezarla
      </h1>
      <p className="text-ink-soft max-w-2xl text-lg text-pretty">
        Sube una foto o un boceto de tu espacio y obtén planos, renders y una memoria de tu proyecto
        en minutos. Explora ideas sin compromiso; cuando tengas tu favorita, valídala con un
        profesional.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/registro">Empezar gratis</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/acceder">Ya tengo cuenta</Link>
        </Button>
      </div>
    </section>
  );
}
