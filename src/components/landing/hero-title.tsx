'use client';
/**
 * Titular del hero: cada línea sube desde detrás de una máscara, escalonada.
 * Con movimiento reducido el titular aparece directamente.
 */
import { motion, useReducedMotion } from 'motion/react';

const LINES: { text: string; accent?: boolean }[] = [
  { text: 'Del plano' },
  { text: 'a tu casa,' },
  { text: 'antes de construirla.', accent: true },
];

export function HeroTitle() {
  const reduced = useReducedMotion();
  return (
    <h1 className="font-display text-[clamp(2.9rem,8.2vw,6.6rem)] leading-[0.95] font-medium tracking-[-0.035em] text-white">
      {LINES.map((line, index) => (
        <span key={line.text} className="block overflow-hidden pb-[0.08em]">
          <motion.span
            className={line.accent ? 'text-brand-100 block italic' : 'block'}
            initial={reduced ? false : { y: '110%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.9, delay: 0.15 + index * 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            {line.text}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}
