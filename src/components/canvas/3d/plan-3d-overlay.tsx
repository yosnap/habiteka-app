'use client';

/**
 * Overlay a pantalla completa con la vista 3D navegable (F6.4). Se abre desde el botón
 * "Ver en 3D" del editor y muestra la escena de la zona activa (el doc que se le pasa).
 * Cierra con el botón X o con Escape.
 *
 * El módulo 3D se carga aquí con `dynamic` (ssr:false): así three/R3F NO entran en el
 * bundle del editor 2D y solo se descargan cuando el usuario abre el 3D.
 */
import dynamic from 'next/dynamic';
import type { CanvasDoc } from '@/canvas/types';
import { useMountEffect } from '@/lib/use-mount-effect';

const Plan3DView = dynamic(() => import('./plan-3d-view').then((m) => m.Plan3DView), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-sm text-white/70">
      Cargando escena 3D…
    </div>
  ),
});

export function Plan3DOverlay({ doc, onClose }: { doc: CanvasDoc; onClose: () => void }) {
  // Cerrar con Escape (listener de montaje con limpieza, patrón del menú contextual).
  useMountEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900">
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar vista 3D"
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-white/20"
      >
        ✕ Cerrar
      </button>
      <Plan3DView doc={doc} />
    </div>
  );
}
