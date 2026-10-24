/**
 * Llamada final: escena oscura con un mosaico de fotos inclinado y titular
 * editorial grande que invita a crear la cuenta.
 */
import { PHOTOS, type PhotoKey } from './landing-examples';
import { Reveal } from './landing-reveal';
import { AtlasPhoto, CtaLink } from './landing-ui';
import styles from './landing.module.css';

const MOSAIC: { key: PhotoKey; className: string }[] = [
  { key: 'cocina', className: '-rotate-6 top-6 left-[-4rem] sm:left-4' },
  { key: 'dormitorio', className: 'rotate-3 bottom-4 left-[10%] hidden md:block' },
  { key: 'exterior', className: 'rotate-6 top-8 right-[-4rem] sm:right-4' },
  { key: 'comedor', className: '-rotate-3 bottom-6 right-[12%] hidden md:block' },
];

export function LandingCTA() {
  return (
    <section className="bg-night relative isolate overflow-hidden px-4 py-28 sm:px-6 sm:py-40">
      <div aria-hidden="true" className={`absolute inset-0 -z-20 opacity-60 ${styles.blueprint}`} />
      <div aria-hidden="true" className={`bg-brand-500/35 absolute top-1/2 left-1/2 -z-10 size-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[160px] ${styles.glow}`} />
      {MOSAIC.map((item) => (
        <AtlasPhoto key={item.key} photo={PHOTOS[item.key]} decorative className={`absolute -z-10 aspect-[3/2] w-48 rounded-2xl opacity-50 shadow-2xl ring-1 ring-white/10 sm:w-64 ${item.className}`} />
      ))}
      <Reveal className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
        <h2 className="font-display text-[clamp(2.8rem,7vw,5.8rem)] leading-[0.98] font-medium tracking-[-0.03em] text-white">
          Empieza por <span className="text-brand-100 italic">tu plano.</span>
        </h2>
        <p className="max-w-xl text-lg text-white/70">
          Crea tu cuenta, sube el plano que tengas y mira tu casa terminada antes de mover un ladrillo.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <CtaLink href="/registro" arrow>Crear cuenta</CtaLink>
          <CtaLink href="/acceder" variant="light">Acceder</CtaLink>
        </div>
      </Reveal>
    </section>
  );
}
