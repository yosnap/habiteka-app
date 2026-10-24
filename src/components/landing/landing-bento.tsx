/**
 * «Todo lo que puedes hacer»: rejilla de funciones reales con fotos, la escena 3D
 * orbitable, la parcela con norte y sol y el retoque por zona animado.
 */
import Image from 'next/image';
import type { ReactNode } from 'react';
import { FileDown, FileImage, FileText, PenLine, Ruler } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORIES_ATLAS, PHOTOS } from './landing-examples';
import { LandingModel3d } from './landing-model-3d';
import { Reveal } from './landing-reveal';
import { AtlasPhoto, ExampleBadge, SectionIntro } from './landing-ui';
import styles from './landing.module.css';

function Card({ title, body, children, className, delay = 0, media }: {
  title: string; body: string; children?: ReactNode; className?: string; delay?: number; media?: ReactNode;
}) {
  return (
    <Reveal delay={delay} className={cn('group border-line bg-surface flex flex-col overflow-hidden rounded-[1.5rem] border transition duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-float)]', className)}>
      {media ? <div className="relative flex-1 overflow-hidden">{media}</div> : null}
      <div className="flex flex-col gap-2 p-6">
        <h3 className="text-ink text-lg font-semibold tracking-tight">{title}</h3>
        <p className="text-ink-soft text-sm leading-relaxed">{body}</p>
        {children}
      </div>
    </Reveal>
  );
}

function ConstructionThumb({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative aspect-[3/2] overflow-hidden bg-white">
      <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 300px, 100vw" className="object-contain transition duration-700 group-hover:scale-105" />
    </div>
  );
}

/** Norte y recorrido del sol sobre la parcela (dibujo técnico). */
function SunOverlay() {
  return (
    <svg viewBox="0 0 400 240" className="absolute inset-0 size-full" fill="none" aria-hidden="true">
      <path d="M40 210 Q200 -10 360 210" className="stroke-white/80" strokeWidth={2} strokeDasharray="5 7" />
      <circle cx={268} cy={70} r={14} className="fill-brand-100 stroke-white" strokeWidth={2} />
      <g transform="translate(352 46)" className="stroke-white">
        <circle r={22} className="fill-black/35" strokeWidth={1.5} />
        <path d="M0 -15 L7 8 L0 3 L-7 8 Z" className="fill-white" strokeWidth={1} />
        <text y={-27} textAnchor="middle" className="fill-white stroke-none text-[12px] font-semibold">N</text>
      </g>
    </svg>
  );
}

const IMPORT_FORMATS = [
  { label: 'Foto', icon: FileImage },
  { label: 'Boceto', icon: PenLine },
  { label: 'PDF', icon: FileText },
  { label: 'CAD', icon: Ruler },
];

export function LandingBento() {
  return (
    <section id="funciones" className="bg-surface scroll-mt-16 py-24 sm:py-32">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <Reveal>
          <SectionIntro
            eyebrow="Funciones"
            title={<>Un editor completo, <span className="text-brand-600 italic">pensado para casas.</span></>}
            body="Construye, amuebla y coloca tu casa en su parcela. El plano 2D, la vista amueblada y el modelo 3D comparten cada cambio."
          />
        </Reveal>
        <div className="mt-14 grid auto-rows-auto gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            className="sm:col-span-2 lg:row-span-2"
            title="Plano 2D, Amueblado y Modelo 3D"
            body="Paredes, puertas, ventanas, patios, techos, falsos techos y luces. Grupos, bloqueos y paquetes reutilizables entre proyectos."
            media={<div className="aspect-[4/3] lg:aspect-auto lg:h-full"><LandingModel3d /></div>}
          />
          <Card delay={0.05} title="Tejados a 1, 2 o 4 aguas" body="También planos, con lucernarios y chimeneas."
            media={<ConstructionThumb src="/images/construction/tejado.webp" alt="Tejado de teja a dos aguas" />} />
          <Card delay={0.1} title="Escaleras y varias plantas" body="Rectas, en L o en U, con descansillos."
            media={<ConstructionThumb src="/images/construction/escalera-u.webp" alt="Escalera en U con barandilla" />} />
          <Card delay={0.05} title="Catálogo realista por estancias" body="Muebles, alfombras, lámparas y plantas con foto real."
            media={
              <div className="grid aspect-[3/2] grid-cols-2 grid-rows-2 gap-1 p-1">
                {[0, 4, 7, 9].map((cell) => (
                  <AtlasPhoto key={cell} decorative photo={{ atlas: CATEGORIES_ATLAS, cell, alt: '' }} className="rounded-lg transition duration-700 group-hover:scale-[1.03]" />
                ))}
              </div>
            } />
          <Card delay={0.1} title="Retoques por zona" body="Marcas un detalle y solo cambia esa zona; el resto de la imagen se conserva."
            media={
              <AtlasPhoto photo={PHOTOS.iluminacion} className="relative aspect-[3/2]">
                <span aria-hidden="true" className={`absolute top-[12%] left-[38%] h-[46%] w-[30%] rounded-xl border-2 border-dashed border-white bg-white/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] ${styles.selection}`} />
                <ExampleBadge className="absolute top-3 right-3" />
              </AtlasPhoto>
            } />
          <Card
            className="sm:col-span-2"
            title="Tu casa en su parcela real"
            body="Sobre la ortofoto oficial IGN/PNOA, con escala, giro, norte y sol. Tapa la casa actual para ver el antes y el después."
            media={<AtlasPhoto photo={PHOTOS.exterior} className="relative aspect-[5/3] sm:aspect-[16/7]"><SunOverlay /><ExampleBadge className="absolute top-3 right-3" /></AtlasPhoto>}
          />
          <Card delay={0.05} title="Importa el plano que tengas" body="Lectura revisada y cotas por estancia editables antes de pasar al editor.">
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {IMPORT_FORMATS.map(({ label, icon: Icon }) => (
                <li key={label} className="bg-surface-muted text-ink flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium">
                  <Icon className="text-brand-600 size-4" aria-hidden="true" />{label}
                </li>
              ))}
            </ul>
          </Card>
          <Card delay={0.1} title="Tus proyectos, portables" body="Exporta el proyecto completo en un archivo .habiteka e impórtalo en otra cuenta.">
            <div className="bg-night mt-3 flex items-center gap-3 rounded-xl px-4 py-3 font-mono text-sm text-white">
              <FileDown className="text-brand-100 size-5 shrink-0" aria-hidden="true" />
              <span className="truncate">mi-casa.habiteka</span>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
