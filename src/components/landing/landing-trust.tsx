/**
 * Control y confianza: el usuario aprueba versiones, acepta diseños, ve el coste
 * y se lleva sus proyectos. Titular grande a la izquierda y cuatro garantías.
 */
import { BadgeCheck, FileDown, Euro, ShieldCheck } from 'lucide-react';
import { TRUST } from './landing-content';
import { Reveal } from './landing-reveal';
import { SectionIntro } from './landing-ui';

const ICONS = [ShieldCheck, BadgeCheck, Euro, FileDown] as const;

export function LandingTrust() {
  return (
    <section className="bg-surface py-24 sm:py-32">
      <div className="mx-auto grid w-full max-w-7xl gap-14 px-4 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
        <Reveal>
          <SectionIntro
            eyebrow="Control"
            title={<>Tú tienes <span className="text-brand-600 italic">la última palabra.</span></>}
            body="La IA propone y revisa; tú decides. Nada llega a una imagen final ni a un vídeo sin tu aceptación."
          />
        </Reveal>
        <ul className="grid gap-5 sm:grid-cols-2">
          {TRUST.map((item, index) => {
            const Icon = ICONS[index % ICONS.length] ?? ShieldCheck;
            return (
              <Reveal as="li" key={item.title} delay={index * 0.08} className="border-line bg-surface-muted rounded-[1.5rem] border p-6">
                <span className="bg-ink grid size-11 place-items-center rounded-2xl text-white">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="text-ink mt-5 text-lg font-semibold">{item.title}</h3>
                <p className="text-ink-soft mt-2 text-sm leading-relaxed">{item.body}</p>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
