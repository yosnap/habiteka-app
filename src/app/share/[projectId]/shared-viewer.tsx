'use client';

/**
 * Visor 3D de solo lectura para la ruta de sharing. Usa Plan3DView sin herramientas
 * de edición (sin selección, sin menú radial, sin catálogo). Solo orbit + captura
 * de renders. Es lo que ve el cliente cuando el interiorista comparte el proyecto.
 */
import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { CanvasDoc } from '@/canvas/types';
import type { ViewAngle } from '@/canvas/3d/camera-views';

const Plan3DView = dynamic(
  () => import('@/components/canvas/3d/plan-3d-view').then((m) => m.Plan3DView),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full w-full place-items-center text-sm text-white/70">
        Cargando vista 3D…
      </div>
    ),
  },
);

export function SharedViewer({
  doc,
  projectName,
}: {
  doc: CanvasDoc;
  projectName: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  return (
    <div className="flex h-screen flex-col bg-neutral-900">
      {/* Cabecera mínima */}
      <header className="flex items-center justify-between px-4 py-2 text-white">
        <span className="text-sm font-medium">{projectName}</span>
        <span className="text-xs text-white/40">Vista compartida · Habiteka</span>
      </header>

      {/* Vista 3D de solo lectura (sin selección, sin edición) */}
      <div className="relative flex-1">
        <Plan3DView
          doc={doc}
          onGenerateView={(url: string) => setDataUrl(url)}
          onDeselect={() => {}}
          onSelect={() => {}}
          onSetMode={() => {}}
        />
      </div>

      {/* Render capturado */}
      {dataUrl ? (
        <div className="absolute bottom-4 left-4 z-10 w-60 overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt="Render" className="w-full object-cover" />
        </div>
      ) : null}
    </div>
  );
}
