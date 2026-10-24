/**
 * Cabecera pública de la home: barra oscura translúcida fija con marca, anclas a
 * las secciones, guía de usuario y accesos a registro/login.
 */
import Link from 'next/link';
import { DOCS_URL } from './landing-content';

const SECTIONS = [
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#demo', label: 'Demo' },
  { href: '#funciones', label: 'Funciones' },
  { href: '#videos', label: 'Vídeos' },
  { href: '#ejemplos', label: 'Ejemplos' },
];

const focus = 'rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

export function LandingHeader() {
  return (
    <header className="bg-night/80 sticky top-0 z-40 border-b border-white/10 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-6">
        <Link href="/" className={`font-display flex shrink-0 items-center gap-2 text-lg font-medium sm:text-xl tracking-tight text-white ${focus}`}>
          <span aria-hidden="true" className="bg-brand-500 grid size-7 place-items-center rounded-lg text-sm font-semibold">H</span>
          Habiteka
        </Link>
        <nav aria-label="Secciones" className="hidden items-center gap-6 text-sm text-white/70 lg:flex">
          {SECTIONS.map((item) => (
            <a key={item.href} href={item.href} className={`transition hover:text-white ${focus}`}>{item.label}</a>
          ))}
          <a href={DOCS_URL} className={`transition hover:text-white ${focus}`}>Guía</a>
        </nav>
        <nav aria-label="Cuenta" className="flex items-center gap-1 sm:gap-2">
          <Link href="/acceder" className={`inline-flex min-h-11 items-center px-2 text-sm sm:px-3 font-medium text-white/80 transition hover:text-white ${focus}`}>
            Acceder
          </Link>
          <Link
            href="/registro"
            className="bg-brand-600 hover:bg-brand-700 focus-visible:outline-brand-500 inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium whitespace-nowrap sm:px-4 text-white transition focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Crear cuenta
          </Link>
        </nav>
      </div>
    </header>
  );
}
