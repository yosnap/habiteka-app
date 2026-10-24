'use client';
/**
 * Contenedor de la escena 3D: no descarga three.js ni los modelos hasta que la
 * tarjeta se acerca a la pantalla, y solo la dibuja mientras está visible. En
 * pantallas táctiles una capa transparente deja pasar el scroll de la página (los
 * controles de órbita lo bloquearían) y la escena gira sola.
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
  const visible = useInView(ref);
  return (
    <div ref={ref} className="bg-sand relative size-full min-h-72" role="group" aria-label="Vista 3D de un salón con muebles del catálogo">
      {near ? <LandingModelScene active={visible} /> : null}
      <div aria-hidden="true" className="absolute inset-0 hidden touch-pan-y pointer-coarse:block" />
      <span className="text-ink pointer-events-none absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium shadow-[var(--shadow-panel)]">
        <Move3d className="size-4" aria-hidden="true" />
        <span className="pointer-coarse:hidden">Arrastra para girar</span>
        <span className="hidden pointer-coarse:inline">Muebles reales del catálogo</span>
      </span>
    </div>
  );
}
