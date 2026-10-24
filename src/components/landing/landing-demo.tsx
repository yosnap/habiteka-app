/**
 * Sección «Pruébalo»: el plano interactivo de ejemplo y el comparador
 * plano guía ↔ diseño, con las garantías de cómo se generan los diseños.
 */
import { Check } from 'lucide-react';
import { CompareSlider } from './compare-slider';
import { PlanDemo } from './plan-demo';
import { Reveal } from './landing-reveal';
import { SectionIntro } from './landing-ui';

const DESIGN_POINTS = [
  'Cada estancia conserva su uso, sus puertas y sus huecos.',
  'Vistas por estancia, exteriores y la planta completa desde arriba.',
  'Retoques por zona: marcas el detalle y el resto se conserva.',
  'Historial de versiones: el original nunca se pierde.',
];

export function LandingDemo() {
  return (
    <section id="demo" className="bg-sand scroll-mt-16 py-24 sm:py-32">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <Reveal>
          <SectionIntro
            eyebrow="Pruébalo aquí"
            title={<>Toca el plano. <span className="text-brand-600 italic">Mira el diseño.</span></>}
            body="Así trabaja Habiteka: el plano manda en la distribución y la IA viste cada estancia. Explora un piso de ejemplo."
          />
        </Reveal>
        <Reveal delay={0.1} className="mt-12">
          <PlanDemo />
        </Reveal>

        <div className="mt-24 grid items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
          <Reveal className="flex flex-col gap-6">
            <SectionIntro
              eyebrow="Diseños con IA"
              title="Fotorrealista, sin perder tu distribución."
              body="Arrastra el control para pasar del plano guía al diseño. Antes de guardarse, cada vista se revisa en circulación, coherencia y realismo; después la aceptas tú."
            />
            <ul className="flex flex-col gap-3">
              {DESIGN_POINTS.map((point) => (
                <li key={point} className="text-ink flex items-start gap-3">
                  <span className="bg-brand-600 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-white">
                    <Check className="size-3.5" aria-hidden="true" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.15}>
            <CompareSlider />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
