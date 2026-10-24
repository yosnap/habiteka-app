/**
 * Piezas compartidas de la home: foto recortada de un atlas, enlaces de llamada a
 * la acción, rótulo de ejemplo ilustrativo y cabecera de sección.
 */
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AtlasPhotoRef } from './landing-examples';

/** Celda de un atlas fotográfico como fondo (un único fichero compartido por muchas tarjetas). */
export function atlasStyle({ atlas, cell }: Pick<AtlasPhotoRef, 'atlas' | 'cell'>): CSSProperties {
  const col = cell % atlas.columns;
  const row = Math.floor(cell / atlas.columns);
  return {
    backgroundImage: `url(${atlas.src})`,
    backgroundSize: `${atlas.columns * 100}% ${atlas.rows * 100}%`,
    backgroundPosition: `${(col / (atlas.columns - 1)) * 100}% ${(row / (atlas.rows - 1)) * 100}%`,
  };
}

/**
 * La celda se dibuja con su proporción real y cubre la caja recortando lo que
 * sobre (como `object-fit: cover`): una caja vertical o panorámica nunca estira
 * la foto. Las unidades de contenedor miden la caja que la recibe.
 */
function coverStyle(atlas: AtlasPhotoRef['atlas']): CSSProperties {
  const ratio = (atlas.width / atlas.columns) / (atlas.height / atlas.rows);
  return {
    width: `max(100cqw, calc(100cqh * ${ratio}))`,
    height: `max(100cqh, calc(100cqw / ${ratio}))`,
  };
}

export function AtlasPhoto({ photo, className, children, decorative = false }: {
  photo: AtlasPhotoRef; className?: string; children?: ReactNode; decorative?: boolean;
}) {
  return (
    <div
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : photo.alt}
      aria-hidden={decorative || undefined}
      className={cn('bg-surface-muted relative overflow-hidden', className)}
      style={{ containerType: 'size' }}
    >
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-no-repeat"
        style={{ ...atlasStyle(photo), ...coverStyle(photo.atlas) }}
      />
      {children}
    </div>
  );
}

const CTA_VARIANTS = {
  primary: 'bg-brand-600 text-white shadow-[0_10px_30px_-10px_var(--color-brand-500)] hover:bg-brand-700',
  light: 'bg-white/10 text-white ring-1 ring-white/25 backdrop-blur hover:bg-white/20',
  ink: 'bg-ink text-white hover:bg-night-soft',
  outline: 'text-ink ring-1 ring-line bg-surface hover:ring-ink/40',
} as const;

export function CtaLink({ href, children, variant = 'primary', arrow = false, className }: {
  href: string; children: ReactNode; variant?: keyof typeof CTA_VARIANTS; arrow?: boolean; className?: string;
}) {
  const classes = cn(
    'group inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[0.95rem] font-medium transition',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
    CTA_VARIANTS[variant],
    className,
  );
  const content = (
    <>
      {children}
      {arrow ? <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /> : null}
    </>
  );
  return href.startsWith('/') ? <Link href={href} className={classes}>{content}</Link> : <a href={href} className={classes}>{content}</a>;
}

/** Rótulo obligatorio en todo proyecto o fotograma de muestra. */
export function ExampleBadge({ className, label = 'Ejemplo ilustrativo' }: { className?: string; label?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full bg-black/55 px-2.5 py-1 text-[0.7rem] font-medium tracking-wide text-white backdrop-blur', className)}>
      {label}
    </span>
  );
}

export function SectionIntro({ eyebrow, title, body, dark = false, align = 'left', className }: {
  eyebrow: string; title: ReactNode; body?: ReactNode; dark?: boolean; align?: 'left' | 'center'; className?: string;
}) {
  return (
    <div className={cn('flex max-w-3xl flex-col gap-4', align === 'center' && 'mx-auto items-center text-center', className)}>
      <span className={cn('text-xs font-semibold tracking-[0.2em] uppercase', dark ? 'text-brand-100' : 'text-brand-600')}>{eyebrow}</span>
      <h2 className={cn('font-display text-4xl leading-[1.05] font-medium tracking-tight text-balance sm:text-5xl lg:text-6xl', dark ? 'text-white' : 'text-ink')}>
        {title}
      </h2>
      {body ? <p className={cn('max-w-2xl text-lg leading-relaxed text-pretty', dark ? 'text-white/70' : 'text-ink-soft')}>{body}</p> : null}
    </div>
  );
}
