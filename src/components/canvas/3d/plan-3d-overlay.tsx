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
import { useCanvasStore } from '@/canvas/canvas-store';
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
  doc: initialDoc,
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
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  // Doc EN VIVO del store: editar el color de una pared (vía updateObject) se refleja al
  // instante en el 3D. Cae al snapshot inicial si el store aún no está hidratado.
  const storeDoc = useCanvasStore((s) => s.doc);
  const updateObject = useCanvasStore((s) => s.updateObject);
  const doc = storeDoc.objects.length ? storeDoc : initialDoc;
  // Menú contextual de pared: id del muro + posición en pantalla del clic derecho.
  const [wallMenu, setWallMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  // Cerrar con Escape (listener de montaje con limpieza, patrón del menú contextual).
  useMountEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Clic derecho sobre una pared en el 3D: abre el menú de pintura en esa posición.
  const onPickWall = (sourceId: string, x: number, y: number) => {
    setWallMenu({ id: sourceId, x, y });
  };

  // Pinta la pared seleccionada con el color elegido (escribe en el store → undo/redo gratis,
  // y el 3D lo refleja al leer el doc en vivo).
  const paintWall = (color: string) => {
    if (wallMenu) updateObject(wallMenu.id, { color });
  };

  // Recibe la captura del ángulo elegido y la manda a la IA para estilizarla. El ángulo ya
  // viene aplicado en la imagen capturada, así que aquí solo importa el data URL.
  const onGenerateView = (dataUrl: string) => {
    setNotice(null);
    setResultUrl(null);
    startTransition(async () => {
      try {
        const outcome = await generateViewFrom3D(projectId, dataUrl, estilo, '16:9', zoneId);
        const url = outcome.deliverables?.find((d) => d.type === 'render3d')?.payload;
        const assetUrl = url && 'assetUrl' in url ? url.assetUrl : null;
        if (assetUrl) {
          setResultUrl(assetUrl);
        } else {
          setNotice('Vista generada. Mírala en la pestaña «Diseños».');
        }
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
        {pending ? <span className="text-xs text-white/70">Generando… (~2 min)</span> : null}
        {notice ? <span className="text-xs text-green-300">{notice}</span> : null}
      </div>

      {/* Render generado: se muestra inline en el overlay nada más terminar. */}
      {resultUrl ? (
        <div className="absolute bottom-16 left-4 z-10 w-72 overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultUrl} alt="Vista estilizada generada" className="w-full object-cover" />
          <div className="flex items-center justify-between bg-black/80 px-3 py-2">
            <span className="text-xs text-green-300">Vista generada</span>
            <button
              type="button"
              onClick={() => setResultUrl(null)}
              aria-label="Cerrar resultado"
              className="text-xs text-white/60 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}

      {/* Menú contextual de pared: elegir el color de pintura. Anclado al clic derecho. */}
      {wallMenu ? (
        <div
          className="absolute z-20 flex items-center gap-2 rounded-md bg-neutral-800 px-3 py-2 text-xs text-white shadow-lg ring-1 ring-white/20"
          style={{ left: wallMenu.x, top: wallMenu.y }}
        >
          <span>Pintar pared</span>
          <input
            type="color"
            aria-label="Color de la pared"
            onChange={(e) => paintWall(e.target.value)}
            className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent"
          />
          <button
            type="button"
            onClick={() => setWallMenu(null)}
            aria-label="Cerrar"
            className="text-white/60 hover:text-white"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* Mientras genera, se desactiva la captura para no encadenar peticiones. */}
      <Plan3DView
        doc={doc}
        onGenerateView={pending ? undefined : onGenerateView}
        onPickWall={onPickWall}
      />
    </div>
  );
}
