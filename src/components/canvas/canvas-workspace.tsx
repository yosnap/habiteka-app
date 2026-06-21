'use client';

/**
 * Orquestador del canvas: toolbar + stage (cargado sin SSR porque Konva necesita
 * `window`). Hidrata el documento inicial en el store y persiste los cambios de
 * contenido al servidor con un debounce, suscribiéndose al store sin efectos en
 * el cuerpo del componente.
 */
import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useCanvasStore } from '@/canvas/canvas-store';
import type { StructObj } from '@/canvas/types';
import { serializeCanvas, deserializeCanvas } from '@/canvas/serialize';
import { useMountEffect } from '@/lib/use-mount-effect';
import { CanvasToolbar, type Tool } from './canvas-toolbar';
import { ObjectPalette } from './object-palette';
import { CanvasContextMenu, type ContextMenuItem } from './context-menu';
import { GenerateFromCanvasDialog } from './generate-from-canvas-dialog';
import { DecorSuggestionsDialog } from './decor-suggestions-dialog';
import { DetectFromPhotoDialog } from './detect-from-photo-dialog';
import { Button } from '@/components/ui/button';
import type { AgentOutcome } from '@/server/agent';
import type { DeliverableType, Estilo, DecorRecommendation, DetectedObject } from '@/lib/contracts';

// Konva no puede renderizar en el servidor: el stage se carga solo en cliente.
const CanvasStage = dynamic(() => import('./canvas-stage').then((m) => m.CanvasStage), {
  ssr: false,
  loading: () => <div className="bg-surface-muted h-full w-full animate-pulse" aria-busy />,
});

interface Props {
  projectId: string;
  initialDoc: unknown;
  saveAction: (projectId: string, payload: unknown) => Promise<void>;
  generateAction: (
    projectId: string,
    rawDoc: unknown,
    estilo: Estilo,
    entregable: DeliverableType,
    objetivo: string,
  ) => Promise<AgentOutcome>;
  recommendAction: (
    projectId: string,
    rawDoc: unknown,
    estilo: Estilo,
    objetivo: string,
  ) => Promise<DecorRecommendation[]>;
  detectAction: (
    projectId: string,
    imageParts: { type: 'image_url'; base64: string; mimeType: string }[],
  ) => Promise<DetectedObject[]>;
}

const DEBOUNCE_MS = 800;

export function CanvasWorkspace({
  projectId,
  initialDoc,
  saveAction,
  generateAction,
  recommendAction,
  detectAction,
}: Props) {
  const [tool, setTool] = useState<Tool>('select');
  // Diálogo de generación de diseño desde el lienzo (CRL-4).
  const [showGenerate, setShowGenerate] = useState(false);
  // Diálogo de sugerencias de decoración por IA (F4).
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Diálogo de detección desde foto (F5, BETA).
  const [showDetect, setShowDetect] = useState(false);
  // El stage de Konva necesita dimensiones en píxeles; se miden del contenedor
  // real y se actualizan al redimensionar, para que el área de dibujo ocupe TODO
  // el espacio disponible (antes era un tamaño fijo que dejaba zonas muertas).
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  // Portapapeles interno del editor (no el del SO): objetos copiados/cortados.
  const clipboardRef = useRef<StructObj[]>([]);
  const pasteSeq = useRef(0);
  // Menú contextual abierto (clic derecho): posición e items, o null si cerrado.
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);

  useMountEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  });

  // Atajos de teclado: Supr/Backspace borra el objeto seleccionado; las flechas lo
  // mueven (paso = rejilla; con Shift, paso fino de 1px). Se ignora si el foco está
  // en un campo de texto para no interferir con la escritura.
  useMountEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      const store = useCanvasStore.getState();
      const sel = store.doc.selection;
      const ids = sel?.type === 'object' ? sel.objectIds : [];
      const ctrl = e.ctrlKey || e.metaKey;

      // Portapapeles interno: copiar/cortar/pegar/duplicar de los seleccionados.
      if (ctrl && e.key.toLowerCase() === 'c' && ids.length) {
        e.preventDefault();
        clipboardRef.current = store.doc.objects.filter((o) => ids.includes(o.id));
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'x' && ids.length) {
        e.preventDefault();
        clipboardRef.current = store.doc.objects.filter((o) => ids.includes(o.id));
        store.removeObjects(ids);
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'v' && clipboardRef.current.length) {
        e.preventDefault();
        let seq = pasteSeq.current;
        const clones = clipboardRef.current.map((o) => {
          seq += 1;
          return { ...o, id: `obj-paste-${seq}`, x: o.x + 20, y: o.y + 20 };
        });
        pasteSeq.current = seq;
        store.insertObjects(clones);
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'd' && ids.length) {
        e.preventDefault();
        store.duplicateObjects(ids);
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) store.ungroupObjects(ids);
        else store.groupObjects(ids);
        return;
      }

      if (!ids.length) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        store.removeObjects(ids);
        return;
      }
      // Paso fino por defecto (1px); con Shift, salto de rejilla (20px).
      const step = e.shiftKey ? 20 : 1;
      const moves: Record<string, [number, number]> = {
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
      };
      const delta = moves[e.key];
      if (delta) {
        e.preventDefault();
        for (const o of store.doc.objects) {
          if (ids.includes(o.id)) {
            store.updateObject(o.id, { x: o.x + delta[0], y: o.y + delta[1] });
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

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

  // Construye los items del menú contextual según la selección actual.
  const buildMenuItems = (): ContextMenuItem[] => {
    const store = useCanvasStore.getState();
    const sel = store.doc.selection;
    const ids = sel?.type === 'object' ? sel.objectIds : [];
    const hasSel = ids.length > 0;
    const hasClip = clipboardRef.current.length > 0;

    const copy = () => {
      clipboardRef.current = store.doc.objects.filter((o) => ids.includes(o.id));
    };
    const paste = () => {
      let seq = pasteSeq.current;
      const clones = clipboardRef.current.map((o) => {
        seq += 1;
        return { ...o, id: `obj-paste-${seq}`, x: o.x + 20, y: o.y + 20 };
      });
      pasteSeq.current = seq;
      store.insertObjects(clones);
    };

    return [
      { label: 'Copiar', onClick: copy, disabled: !hasSel },
      {
        label: 'Cortar',
        onClick: () => {
          copy();
          store.removeObjects(ids);
        },
        disabled: !hasSel,
      },
      { label: 'Pegar', onClick: paste, disabled: !hasClip },
      { label: 'Duplicar', onClick: () => store.duplicateObjects(ids), disabled: !hasSel },
      { label: '-', onClick: () => {} },
      {
        label: 'Girar 90°',
        onClick: () => store.rotate90(ids),
        disabled: !hasSel,
      },
      {
        label: 'Voltear',
        onClick: () => store.flipSelection(ids),
        disabled: !hasSel,
      },
      { label: '-', onClick: () => {} },
      { label: 'Agrupar', onClick: () => store.groupObjects(ids), disabled: ids.length < 2 },
      { label: 'Desagrupar', onClick: () => store.ungroupObjects(ids), disabled: !hasSel },
      { label: '-', onClick: () => {} },
      { label: 'Traer al frente', onClick: () => store.bringToFront(ids), disabled: !hasSel },
      { label: 'Enviar al fondo', onClick: () => store.sendToBack(ids), disabled: !hasSel },
      { label: 'Subir una capa', onClick: () => store.bringForward(ids), disabled: !hasSel },
      { label: 'Bajar una capa', onClick: () => store.sendBackward(ids), disabled: !hasSel },
      { label: '-', onClick: () => {} },
      { label: 'Eliminar', onClick: () => store.removeObjects(ids), disabled: !hasSel },
    ];
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <CanvasToolbar tool={tool} onToolChange={setTool} />
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setShowDetect(true)}
            title="Detectar elementos desde una foto o plano (beta)"
          >
            Detectar desde foto
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setShowSuggestions(true)}
            title="Pedir a la IA elementos de decoración para tu plano"
          >
            Sugerir decoración
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowGenerate(true)}
            title="Usar la disposición del plano para generar un diseño con IA"
          >
            Generar diseño desde el plano
          </Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 gap-2">
        <ObjectPalette tool={tool} onPick={setTool} />
        <div
          ref={containerRef}
          className="border-line bg-surface flex-1 overflow-hidden rounded-card border"
        >
          {size.width > 0 && size.height > 0 ? (
            <CanvasStage
              tool={tool}
              width={size.width}
              height={size.height}
              onObjectCreated={() => setTool('select')}
              onContextMenu={(x, y) => setMenu({ x, y, items: buildMenuItems() })}
            />
          ) : null}
        </div>
      </div>
      {menu ? (
        <CanvasContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      ) : null}
      {showGenerate ? (
        <GenerateFromCanvasDialog
          projectId={projectId}
          generateAction={generateAction}
          onClose={() => setShowGenerate(false)}
        />
      ) : null}
      {showSuggestions ? (
        <DecorSuggestionsDialog
          projectId={projectId}
          recommendAction={recommendAction}
          onClose={() => setShowSuggestions(false)}
        />
      ) : null}
      {showDetect ? (
        <DetectFromPhotoDialog
          projectId={projectId}
          detectAction={detectAction}
          onClose={() => setShowDetect(false)}
        />
      ) : null}
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
