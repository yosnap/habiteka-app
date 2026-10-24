/**
 * «Cómo funciona»: los cinco pasos reales del producto con números grandes, una
 * línea de progreso que se traza al entrar y la franja de cifras del producto.
 */
import { FACTS, STEPS } from './landing-content';
import { ProgressLine } from './progress-line';
import { Reveal } from './landing-reveal';
import { SectionIntro } from './landing-ui';

export function LandingHowItWorks() {
  return (
    <section id="como-funciona" className="bg-surface scroll-mt-16 py-24 sm:py-32">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <Reveal>
          <SectionIntro
            eyebrow="Cómo funciona"
            title={<>Un solo proyecto, <span className="text-brand-600 italic">de principio a fin.</span></>}
            body="Del plano que ya tienes a las imágenes y vídeos que vas a enseñar. Tú decides en cada paso qué se da por bueno."
          />
        </Reveal>
        <div className="relative mt-16">
          <ProgressLine />
          <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
            {STEPS.map((step, index) => (
              <Reveal as="li" key={step.title} delay={index * 0.1} className="relative flex flex-col gap-3 lg:pt-10">
                <span className="font-display text-brand-500 text-6xl leading-none font-medium italic">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="text-ink text-xl font-semibold tracking-tight">{step.title}</h3>
                <p className="text-ink-soft leading-relaxed">{step.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
        <dl className="border-line mt-20 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border bg-[var(--color-line)] lg:grid-cols-4">
          {FACTS.map((fact, index) => (
            <Reveal key={fact.label} delay={index * 0.08} className="bg-surface-muted flex flex-col gap-2 p-6 sm:p-8">
              <dt className="sr-only">{fact.label}</dt>
              <dd className="font-display text-ink text-4xl font-medium tracking-tight sm:text-5xl">{fact.value}</dd>
              <dd className="text-ink-soft text-sm leading-snug">{fact.label}</dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
