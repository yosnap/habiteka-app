'use client';

/**
 * Overlay a pantalla completa con la vista 3D navegable (F6.4). Se abre desde el botón
 * "Ver en 3D" del editor y muestra la escena de la zona activa (el doc que se le pasa).
 * Cierra con el botón X o con Escape.
 *
 * Además permite GENERAR una vista estilizada desde el 3D (Fase 3): el usuario elige un
 * ángulo en el visor (perspectiva/isométrica/cenital) y un estilo; la captura del canvas
 * WebGL se envía a la IA (img2img) como imagen base. El resultado queda en «Diseños» de la
 * zona. La zona activa se lee de la URL (`?zona=`), igual que el resto del editor.
 *
 * El módulo 3D se carga aquí con `dynamic` (ssr:false): así three/R3F NO entran en el
 * bundle del editor 2D y solo se descargan cuando el usuario abre el 3D.
 */
import dynamic from 'next/dynamic';
import { useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import type { CanvasDoc } from '@/canvas/types';
import type { Estilo } from '@/lib/contracts';
import { ESTILOS } from '@/lib/design-options';
import { useMountEffect } from '@/lib/use-mount-effect';
import { generateViewFrom3D } from '@/app/(app)/projects/[id]/_actions/agent-actions';

const Plan3DView = dynamic(() => import('./plan-3d-view').then((m) => m.Plan3DView), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-sm text-white/70">
      Cargando escena 3D…
    </div>
  ),
});

export function Plan3DOverlay({
  doc,
  projectId,
  onClose,
}: {
  doc: CanvasDoc;
  projectId: string;
  onClose: () => void;
}) {
  const searchParams = useSearchParams();
  const zoneId = searchParams.get('zona');
  const [estilo, setEstilo] = useState<Estilo>(ESTILOS[0]!.value);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  // Cerrar con Escape (listener de montaje con limpieza, patrón del menú contextual).
  useMountEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Recibe la captura del ángulo elegido y la manda a la IA para estilizarla. El ángulo ya
  // viene aplicado en la imagen capturada, así que aquí solo importa el data URL.
  const onGenerateView = (dataUrl: string) => {
    setNotice(null);
    startTransition(async () => {
      try {
        await generateViewFrom3D(projectId, dataUrl, estilo, '16:9', zoneId);
        setNotice('Vista generada. Mírala en la pestaña «Diseños».');
      } catch (err) {
        setNotice(err instanceof Error ? err.message : 'No se pudo generar la vista.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900">
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar vista 3D"
        className="absolute right-4 top-4 z-10 rounded-full bg-neutral-900/90 px-4 py-2 text-sm font-medium text-white shadow-lg ring-1 ring-white/20 hover:bg-neutral-800"
      >
        ✕ Cerrar
      </button>

      {/* Selector de estilo para la vista a generar + estado (abajo a la izquierda). */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-md bg-black/70 px-3 py-2">
        <label className="text-xs text-white/80">
          Estilo de la vista:{' '}
          <select
            value={estilo}
            onChange={(e) => setEstilo(e.target.value as Estilo)}
            disabled={pending}
            className="ml-1 rounded bg-neutral-800 px-2 py-1 text-xs text-white"
          >
            {ESTILOS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {pending ? <span className="text-xs text-white/70">Generando…</span> : null}
        {notice ? <span className="text-xs text-green-300">{notice}</span> : null}
      </div>

      {/* Mientras genera, se desactiva la captura para no encadenar peticiones. */}
      <Plan3DView doc={doc} onGenerateView={pending ? undefined : onGenerateView} />
    </div>
  );
}
