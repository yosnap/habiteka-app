/**
 * Hero: escena nocturna con rejilla de plano y halo terracota, titular editorial
 * animado y la pieza que convierte un plano técnico en la foto amueblada.
 */
import { FileImage, FileText, PenLine, Ruler } from 'lucide-react';
import { HeroPlanReveal } from './hero-plan-reveal';
import { HeroTitle } from './hero-title';
import { CtaLink } from './landing-ui';
import hero from './hero.module.css';
import styles from './landing.module.css';

// El hero no usa `Reveal`: su contenido se pinta sin esperar a la hidratación.
const appear = (delay: number, className = '') => ({ className: `${hero.fadeUp} ${className}`, style: { animationDelay: `${delay}s` } });

const FORMATS = [
  { label: 'Foto', icon: FileImage },
  { label: 'Boceto', icon: PenLine },
  { label: 'PDF', icon: FileText },
  { label: 'CAD', icon: Ruler },
];

export function LandingHero() {
  return (
    <section className="bg-night relative isolate overflow-hidden">
      <div aria-hidden="true" className={`absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)] ${styles.blueprint}`} />
      <div aria-hidden="true" className={`bg-brand-500/30 absolute top-[-20%] right-[-10%] -z-10 size-[42rem] rounded-full blur-[140px] ${styles.glow}`} />
      <div aria-hidden="true" className="bg-sage/20 absolute bottom-[-30%] left-[-15%] -z-10 size-[36rem] rounded-full blur-[140px]" />

      <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:pt-24 lg:pb-28">
        <div className="flex flex-col items-start gap-7">
          <div {...appear(0)}>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3.5 py-1.5 text-xs font-medium text-white/80 ring-1 ring-white/15">
              <span className="bg-brand-500 size-1.5 rounded-full" aria-hidden="true" />
              Plano · Diseño con IA · Vídeo
            </span>
          </div>
          <HeroTitle />
          <div {...appear(0.45)}>
            <p className="max-w-xl text-lg leading-relaxed text-pretty text-white/70 sm:text-xl">
              Sube el plano de tu vivienda, complétalo en 2D y 3D y genera diseños fotorrealistas
              que respetan su distribución. Después, preséntalo con imágenes y vídeos.
            </p>
          </div>
          <div {...appear(0.55, 'flex flex-wrap items-center gap-3')}>
            <CtaLink href="/registro" arrow>Crear cuenta</CtaLink>
            <CtaLink href="#demo" variant="light">Probar la demo</CtaLink>
          </div>
          <div {...appear(0.65, 'flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/55')}>
            <span>Empieza con:</span>
            {FORMATS.map(({ label, icon: Icon }) => (
              <span key={label} className="inline-flex items-center gap-1.5 text-white/80">
                <Icon className="text-brand-100 size-4" aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </div>
        <div {...appear(0.3)}>
          <HeroPlanReveal />
        </div>
      </div>
    </section>
  );
}
