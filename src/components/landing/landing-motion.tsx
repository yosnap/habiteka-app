'use client';
/**
 * Preferencias de animación de toda la home: con «reducir movimiento» del sistema,
 * motion anula desplazamientos y escalados sin cambiar el HTML renderizado, así el
 * servidor y el cliente coinciden siempre en la hidratación.
 */
import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

export function LandingMotion({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
