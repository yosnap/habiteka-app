/**
 * Pie de la home: marca, enlaces a las secciones, guía y Términos, y la nota de
 * confianza (las propuestas son conceptuales y requieren un profesional antes de
 * ejecutar una obra).
 */
import Link from 'next/link';
import { DOCS_URL } from './landing-content';

const link = 'rounded-sm text-white/65 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

export function LandingFooter() {
  return (
    <footer className="bg-night border-t border-white/10 text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="max-w-sm">
            <p className="font-display text-2xl font-medium">Habiteka</p>
            <p className="mt-3 text-sm leading-relaxed text-white/55">
              Del plano a tu casa terminada: editor 2D y 3D, diseños fotorrealistas con IA y vídeos
              para presentarla.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 text-sm">
            <nav aria-label="Producto" className="flex flex-col gap-3">
              <span className="text-xs font-semibold tracking-[0.18em] text-white/55 uppercase">Producto</span>
              <a href="#como-funciona" className={link}>Cómo funciona</a>
              <a href="#funciones" className={link}>Funciones</a>
              <a href="#videos" className={link}>Vídeos</a>
              <a href="#ejemplos" className={link}>Ejemplos</a>
            </nav>
            <nav aria-label="Ayuda y cuenta" className="flex flex-col gap-3">
              <span className="text-xs font-semibold tracking-[0.18em] text-white/55 uppercase">Ayuda</span>
              <a href={DOCS_URL} className={link}>Guía de usuario</a>
              <Link href="/registro" className={link}>Crear cuenta</Link>
              <Link href="/acceder" className={link}>Acceder</Link>
              <Link href="/legal/terminos" className={link}>Términos de Servicio</Link>
            </nav>
          </div>
        </div>
        <p className="mt-12 rounded-2xl bg-white/[0.05] p-5 text-sm leading-relaxed text-white/60 ring-1 ring-white/10">
          <span className="font-medium text-white">Diseño para inspirarte.</span> Las propuestas de
          Habiteka son conceptuales y pensadas para ayudarte a explorar ideas. Los proyectos de la
          home son ejemplos ilustrativos. Antes de ejecutar una reforma, valida las propuestas con un
          profesional cualificado que firme el proyecto técnico.
        </p>
        <p className="mt-8 text-xs text-white/55">© {new Date().getFullYear()} Habiteka</p>
      </div>
    </footer>
  );
}
