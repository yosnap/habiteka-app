'use client';
/** Línea que recorre los cinco pasos al entrar en pantalla (solo en escritorio). */
import { motion, useReducedMotion } from 'motion/react';

export function ProgressLine() {
  const reduced = useReducedMotion();
  return (
    <div aria-hidden="true" className="bg-line absolute top-0 right-0 left-0 hidden h-px lg:block">
      <motion.div
        className="from-brand-500 to-sage h-full origin-left bg-gradient-to-r"
        initial={{ scaleX: reduced ? 1 : 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: '0px 0px -20% 0px' }}
        transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
