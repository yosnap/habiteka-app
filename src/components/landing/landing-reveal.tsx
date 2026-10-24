'use client';
/**
 * Aparición al entrar en pantalla (subida + fundido), escalonable con `delay`.
 * Con movimiento reducido, el `MotionConfig` de la home anula el desplazamiento;
 * el HTML del servidor y del cliente es siempre el mismo.
 */
import { motion } from 'motion/react';
import type { ReactNode } from 'react';

export function Reveal({ children, delay = 0, y = 28, className, as = 'div' }: {
  children: ReactNode; delay?: number; y?: number; className?: string; as?: 'div' | 'li';
}) {
  const Component = as === 'li' ? motion.li : motion.div;
  return (
    <Component
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Component>
  );
}
