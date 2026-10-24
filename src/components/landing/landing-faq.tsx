/**
 * Preguntas frecuentes con desplegables nativos (accesibles con teclado y sin
 * JavaScript), en dos columnas: titular y enlace a la guía, y respuestas.
 */
import { Plus } from 'lucide-react';
import { DOCS_URL, FAQ } from './landing-content';
import { Reveal } from './landing-reveal';
import { SectionIntro } from './landing-ui';

export function LandingFaq() {
  return (
    <section className="bg-sand py-24 sm:py-32">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
        <Reveal className="flex flex-col gap-6">
          <SectionIntro eyebrow="Preguntas" title="Lo que suele preguntarse." />
          <p className="text-ink-soft">
            ¿Más dudas? La{' '}
            <a href={DOCS_URL} className="text-brand-700 font-medium underline underline-offset-4">guía de usuario</a>{' '}
            explica el proceso completo.
          </p>
        </Reveal>
        <div className="flex flex-col gap-3">
          {FAQ.map((item, index) => (
            <Reveal key={item.q} delay={index * 0.05}>
              <details className="group bg-surface rounded-2xl px-6 py-5 shadow-[var(--shadow-panel)]">
                <summary className="text-ink focus-visible:outline-brand-500 flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 rounded-md text-lg font-medium focus-visible:outline-2 focus-visible:outline-offset-4">
                  {item.q}
                  <Plus className="text-brand-600 size-5 shrink-0 transition-transform duration-300 group-open:rotate-45" aria-hidden="true" />
                </summary>
                <p className="text-ink-soft mt-3 leading-relaxed">{item.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
