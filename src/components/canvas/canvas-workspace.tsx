'use client';

/**
 * Orquestador del canvas: toolbar + stage (cargado sin SSR porque Konva necesita
 * `window`). Hidrata el documento inicial en el store y persiste los cambios de
 * contenido al servidor con un debounce, suscribiéndose al store sin efectos en
 * el cuerpo del componente.
 */
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useCanvasStore } from '@/canvas/canvas-store';
import { serializeCanvas, deserializeCanvas } from '@/canvas/serialize';
import { useMountEffect } from '@/lib/use-mount-effect';
import { CanvasToolbar, type Tool } from './canvas-toolbar';

// Konva no puede renderizar en el servidor: el stage se carga solo en cliente.
const CanvasStage = dynamic(() => import('./canvas-stage').then((m) => m.CanvasStage), {
  ssr: false,
  loading: () => <div className="bg-surface-muted h-full w-full animate-pulse" aria-busy />,
});

interface Props {
  projectId: string;
  initialDoc: unknown;
  saveAction: (projectId: string, payload: unknown) => Promise<void>;
  width?: number;
  height?: number;
}

const DEBOUNCE_MS = 800;

export function CanvasWorkspace({
  projectId,
  initialDoc,
  saveAction,
  width = 960,
  height = 640,
}: Props) {
  const [tool, setTool] = useState<Tool>('select');

  // Al montar: hidrata el documento inicial e instala el autoguardado con
  // debounce. Es un efecto de montaje legítimo (suscripción a un store externo +
  // sincronización a servidor); su limpieza cancela el temporizador y la
  // suscripción al desmontar.
  useMountEffect(() => {
    useCanvasStore.getState().load(deserializeCanvas(initialDoc));

    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = useCanvasStore.subscribe((state, prev) => {
      // Solo persiste cambios de CONTENIDO (la selección es UI efímera).
      if (state.doc === prev.doc) return;
      if (sameContent(state.doc, prev.doc)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void saveAction(projectId, serializeCanvas(useCanvasStore.getState().doc));
      }, DEBOUNCE_MS);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  });

  return (
    <div className="flex h-full flex-col gap-2">
      <CanvasToolbar tool={tool} onToolChange={setTool} />
      <div className="border-line bg-surface flex-1 overflow-hidden rounded-[var(--radius-card)] border">
        <CanvasStage tool={tool} width={width} height={height} />
      </div>
    </div>
  );
}

// Compara solo el contenido persistible (ignora la selección) para no guardar
// cuando lo único que cambió fue la selección.
function sameContent(
  a: { strokes: unknown; objects: unknown; products: unknown; baseImage: unknown },
  b: typeof a,
): boolean {
  return (
    a.strokes === b.strokes &&
    a.objects === b.objects &&
    a.products === b.products &&
    a.baseImage === b.baseImage
  );
}
