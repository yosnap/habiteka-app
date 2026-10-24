'use client';
/**
 * Pieza central del hero: un plano técnico de un salón se dibuja solo (muros,
 * puerta, ventana, muebles y cotas) y un barrido lo convierte en la foto
 * amueblada. Bucle de 9 s; con movimiento reducido se muestra la foto quieta.
 */
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { Check, Ruler, Sparkles } from 'lucide-react';
import { PHOTOS } from './landing-examples';
import { AtlasPhoto, ExampleBadge } from './landing-ui';
import styles from './landing.module.css';

const LOOP = { duration: 9, repeat: Infinity, ease: 'easeInOut' as const };
const DRAW = { pathLength: [0, 1, 1, 1], opacity: [1, 1, 1, 0] };
const DRAW_TIMES = { ...LOOP, times: [0, 0.3, 0.9, 1] };

const LINE = 'stroke-white/85';
const SOFT = 'stroke-white/45';
const DIM = 'stroke-brand-100';

function PlanDrawing({ animated }: { animated: boolean }) {
  const drawn = animated ? { initial: { pathLength: 0 }, animate: DRAW, transition: DRAW_TIMES } : {};
  return (
    <svg viewBox="0 0 600 400" className="absolute inset-0 size-full" fill="none" aria-hidden="true">
      {/* Muros exteriores con hueco de puerta (abajo) y ventana (arriba). */}
      <motion.path {...drawn} className={LINE} strokeWidth={10} strokeLinecap="square"
        d="M80 60 H250 M370 60 H520 V340 H330 M250 340 H80 V60" />
      <motion.path {...drawn} className={SOFT} strokeWidth={2} d="M250 52 H370 M250 68 H370" />
      <motion.path {...drawn} className={SOFT} strokeWidth={2} d="M330 340 A80 80 0 0 0 250 260 M250 340 V260" />
      {/* Mobiliario: alfombra, sofá en L, mesa redonda y butaca. */}
      <motion.path {...drawn} className={SOFT} strokeWidth={1.5} strokeDasharray="6 6" d="M150 150 H440 V300 H150 Z" />
      <motion.path {...drawn} className={LINE} strokeWidth={2.5} d="M120 100 H420 V150 H180 V250 H120 Z" />
      <motion.circle {...drawn} className={LINE} strokeWidth={2.5} cx={300} cy={225} r={42} />
      <motion.path {...drawn} className={LINE} strokeWidth={2.5} d="M450 230 H500 V300 H450 Z" />
      {/* Cotas. */}
      <motion.path {...drawn} className={DIM} strokeWidth={1.5} d="M80 30 H520 M80 22 V38 M520 22 V38 M550 60 H550 M550 60 V340 M542 60 H558 M542 340 H558" />
      <motion.g
        initial={animated ? { opacity: 0 } : false}
        animate={animated ? { opacity: [0, 0, 1, 1, 0] } : undefined}
        transition={{ ...LOOP, times: [0, 0.2, 0.3, 0.9, 1] }}
        className="fill-brand-100 font-mono text-[15px]"
      >
        <text x={300} y={20} textAnchor="middle">5,20 m</text>
        <text x={570} y={205} textAnchor="middle" transform="rotate(90 570 205)">4,60 m</text>
        <text x={300} y={380} textAnchor="middle" className="fill-white/60">SALÓN · 23,9 m²</text>
      </motion.g>
    </svg>
  );
}

export function HeroPlanReveal() {
  const reduced = useReducedMotion();
  const animated = !reduced;
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className={`bg-night-soft relative aspect-[3/2] overflow-hidden rounded-[1.75rem] shadow-[0_40px_120px_-30px_oklch(0.62_0.16_40/0.55)] ring-1 ring-white/15 ${styles.blueprint}`}>
        <PlanDrawing animated={animated} />
        <motion.div
          className="absolute inset-0"
          initial={animated ? { clipPath: 'inset(0 100% 0 0)' } : false}
          animate={animated ? { clipPath: ['inset(0 100% 0 0)', 'inset(0 100% 0 0)', 'inset(0 0% 0 0)', 'inset(0 0% 0 0)', 'inset(0 0% 0 100%)'] } : undefined}
          transition={{ ...LOOP, times: [0, 0.42, 0.6, 0.88, 1] }}
        >
          <AtlasPhoto photo={PHOTOS.salon} className="size-full" />
        </motion.div>
        {animated ? (
          <motion.span
            aria-hidden="true"
            className="bg-brand-100 absolute inset-y-0 w-0.5 shadow-[0_0_24px_6px_oklch(0.93_0.05_40/0.7)]"
            animate={{ left: ['0%', '0%', '100%', '100%'], opacity: [0, 1, 1, 0] }}
            transition={{ ...LOOP, times: [0, 0.42, 0.6, 0.62] }}
          />
        ) : null}
        <ExampleBadge className="absolute right-3 bottom-3" />
      </div>
      <Chip className="-top-5 left-4 sm:-left-6" icon={<Ruler className="size-4" />} delay="0s">Cotas por estancia</Chip>
      <Chip className="top-1/2 -right-2 hidden sm:flex lg:-right-8" icon={<Sparkles className="size-4" />} delay="-2s">Respeta la distribución</Chip>
      <Chip className="-bottom-5 left-8 sm:left-16" icon={<Check className="size-4" />} delay="-4s">Aceptado por ti</Chip>
    </div>
  );
}

function Chip({ children, icon, className, delay }: { children: string; icon: ReactNode; className: string; delay: string }) {
  return (
    <span
      className={`text-ink absolute z-10 flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-2 text-xs font-semibold shadow-[var(--shadow-float)] ${styles.float} ${className}`}
      style={{ animationDelay: delay }}
    >
      <span className="bg-brand-50 text-brand-700 grid size-6 place-items-center rounded-full">{icon}</span>
      {children}
    </span>
  );
}
