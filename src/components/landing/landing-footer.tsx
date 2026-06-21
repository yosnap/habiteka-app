/**
 * Pie de la landing con la nota de confianza (disclaimer conceptual presentado en
 * positivo) y el enlace a los Términos.
 */
import Link from 'next/link';

export function LandingFooter() {
  return (
    <footer className="border-line bg-surface-muted mt-8 border-t">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="border-line bg-surface mb-6 rounded-card border p-5">
          <p className="text-ink-soft text-sm">
            <span className="text-ink font-medium">Diseño para inspirarte.</span> Las propuestas de
            Habiteka son conceptuales y pensadas para ayudarte a explorar ideas. Antes de ejecutar
            una reforma, valídalas con un profesional cualificado que firme el proyecto técnico.
          </p>
        </div>
        <div className="text-ink-soft flex flex-wrap items-center justify-between gap-2 text-xs">
          <span>© {new Date().getFullYear()} Habiteka</span>
          <Link href="/legal/terminos" className="underline">
            Términos de Servicio
          </Link>
        </div>
      </div>
    </footer>
  );
}
