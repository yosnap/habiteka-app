/**
 * Galería de proyectos de muestra. Son ejemplos ilustrativos inventados (sin
 * clientes ni valoraciones) y cada tarjeta lo rotula. Al pasar el ratón,
 * la foto cambia a otra estancia del mismo proyecto.
 */
import { MapPin } from 'lucide-react';
import { PHOTOS, SAMPLE_PROJECTS } from './landing-examples';
import { Reveal } from './landing-reveal';
import { AtlasPhoto, CtaLink, ExampleBadge, SectionIntro } from './landing-ui';

export function LandingGallery() {
  return (
    <section id="ejemplos" className="bg-surface-muted scroll-mt-16 py-24 sm:py-32">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <SectionIntro
              eyebrow="Ejemplos"
              title={<>Ideas para <span className="text-brand-600 italic">tu próximo proyecto.</span></>}
              body="Proyectos de muestra para ver qué puedes preparar con Habiteka: del piso en ciudad a la casa de campo."
            />
          </Reveal>
          <Reveal delay={0.1}>
            <CtaLink href="/registro" variant="ink" arrow>Empieza el tuyo</CtaLink>
          </Reveal>
        </div>
        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_PROJECTS.map((project, index) => (
            <Reveal as="li" key={project.title} delay={(index % 3) * 0.08}>
              <article className="group bg-surface flex h-full flex-col overflow-hidden rounded-[1.5rem] shadow-[var(--shadow-panel)] transition duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-float)]">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <AtlasPhoto photo={PHOTOS[project.cover]} className="absolute inset-0 transition duration-700 group-hover:scale-105" />
                  <AtlasPhoto photo={PHOTOS[project.alternate]} decorative className="absolute inset-0 opacity-0 transition duration-700 group-hover:scale-105 group-hover:opacity-100" />
                  <ExampleBadge className="absolute top-3 left-3" />
                </div>
                <div className="flex flex-1 flex-col gap-3 p-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-display text-ink text-2xl font-medium tracking-tight">{project.title}</h3>
                    <span className="text-ink-soft inline-flex shrink-0 items-center gap-1 text-sm"><MapPin className="size-3.5" aria-hidden="true" />{project.place}</span>
                  </div>
                  <p className="text-ink-soft text-sm leading-relaxed">{project.summary}</p>
                  <ul className="mt-auto flex flex-wrap gap-2 pt-2">
                    {project.deliverables.map((item) => (
                      <li key={item} className="bg-brand-50 text-brand-700 rounded-full px-3 py-1 text-xs font-medium">{item}</li>
                    ))}
                  </ul>
                </div>
              </article>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
