'use client';
/**
 * Contenedor de la escena 3D: no descarga three.js ni los modelos hasta que la
 * tarjeta se acerca a la pantalla, para no lastrar el primer pintado.
 */
import dynamic from 'next/dynamic';
import { useInView } from 'motion/react';
import { useRef } from 'react';
import { Move3d } from 'lucide-react';

const LandingModelScene = dynamic(() => import('./landing-model-scene'), {
  ssr: false,
  loading: () => <div className="bg-sand absolute inset-0 animate-pulse" />,
});

export function LandingModel3d() {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { once: true, margin: '300px 0px' });
  return (
    <div ref={ref} className="bg-sand relative size-full min-h-72 touch-pan-y" role="group" aria-label="Vista 3D de un salón con muebles del catálogo; arrastra para girarla">
      {near ? <LandingModelScene /> : null}
      <span className="text-ink pointer-events-none absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium shadow-[var(--shadow-panel)]">
        <Move3d className="size-4" aria-hidden="true" />
        Arrastra para girar
      </span>
    </div>
  );
}
