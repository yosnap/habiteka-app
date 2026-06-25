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
import { setClipboard, hasClipboard, takeClipboardClones } from '@/canvas/canvas-clipboard';
import { serializeCanvas, deserializeCanvas } from '@/canvas/serialize';
import { useMountEffect } from '@/lib/use-mount-effect';
import { CanvasToolbar, type Tool } from './canvas-toolbar';
import { CatalogSidebar } from '@/components/catalog/catalog-sidebar';
import { CanvasContextMenu, type ContextMenuItem } from './context-menu';
import { GenerateFromCanvasDialog } from './generate-from-canvas-dialog';
import { DecorSuggestionsDialog } from './decor-suggestions-dialog';
import { DetectFromPhotoDialog } from './detect-from-photo-dialog';
import { Plan3DOverlay } from './3d/plan-3d-overlay';
import { SmartWizard } from '@/components/wizard/smart-wizard';
import { ZonePhotosPanel } from '@/components/zones/zone-photos-panel';
import { Button } from '@/components/ui/button';
import type { CanvasDoc } from '@/canvas/types';
import type { AgentOutcome } from '@/server/agent';
import type { DeliverableType, Estilo, DecorRecommendation, DetectedObject } from '@/lib/contracts';

// Konva no puede renderizar en el servidor: el stage se carga solo en cliente.
const CanvasStage = dynamic(() => import('./canvas-stage').then((m) => m.CanvasStage), {
  ssr: false,
  loading: () => <div className="bg-surface-muted h-full w-full animate-pulse" aria-busy />,
});

interface Props {
  projectId: string;
  /** Zona activa del plano; null = plano por defecto del proyecto. */
  activeZoneId: string | null;
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
  activeZoneId,
  initialDoc,
  saveAction,
  generateAction,
  recommendAction,
  detectAction,
}: Props) {
  const [tool, setTool] = useState<Tool>('select');
  // Panel de fotos de la zona (F2): overlay para gestionar la foto activa (img2img)
  // sin tapar el lienzo de Konva.
  const [showPhotos, setShowPhotos] = useState(false);
  // Diálogo de generación de diseño desde el lienzo (CRL-4).
  const [showGenerate, setShowGenerate] = useState(false);
  // Diálogo de sugerencias de decoración por IA (F4).
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Diálogo de detección desde foto (F5, BETA).
  const [showDetect, setShowDetect] = useState(false);
  // Vista 3D navegable (F6): se captura el doc de la zona activa al abrir.
  const [doc3D, setDoc3D] = useState<CanvasDoc | null>(null);
  // Asistente de diseño (F7): se ofrece al abrir una zona vacía (sin contenido alguno).
  const [showWizard, setShowWizard] = useState(false);
  // Aviso temporal tras amueblar: qué muebles no cupieron en la sala (decisión: avisar, no solapar).
  const [furnishNotice, setFurnishNotice] = useState<string | null>(null);
  // El stage de Konva necesita dimensiones en píxeles; se miden del contenedor
  // real y se actualizan al redimensionar, para que el área de dibujo ocupe TODO
  // el espacio disponible (antes era un tamaño fijo que dejaba zonas muertas).
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
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
      // El portapapeles vive a nivel de módulo (canvas-clipboard), así que sobrevive
      // al cambio de zona y permite copiar/cortar en una zona y pegar en otra.
      if (ctrl && e.key.toLowerCase() === 'c' && ids.length) {
        e.preventDefault();
        setClipboard(store.doc.objects.filter((o) => ids.includes(o.id)));
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'x' && ids.length) {
        e.preventDefault();
        setClipboard(store.doc.objects.filter((o) => ids.includes(o.id)));
        store.removeObjects(ids);
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'v' && hasClipboard()) {
        e.preventDefault();
        store.insertObjects(takeClipboardClones());
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
    const hydrated = deserializeCanvas(initialDoc);
    useCanvasStore.getState().load(hydrated);
    // Si la zona está completamente vacía (sin objetos, trazos, imagen base ni productos),
    // se ofrece el asistente de diseño. Cuenta TODO el contenido, no solo `objects`, para no
    // pisar un plano calcado a mano (trazos/imagen) al cargar el doc del wizard.
    if (isDocEmpty(hydrated)) setShowWizard(true);

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
    const hasClip = hasClipboard();

    const copy = () => {
      setClipboard(store.doc.objects.filter((o) => ids.includes(o.id)));
    };
    const paste = () => {
      store.insertObjects(takeClipboardClones());
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
    <div className="relative flex h-full flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <CanvasToolbar tool={tool} onToolChange={setTool} />
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            size="sm"
            variant={showPhotos ? 'default' : 'ghost'}
            onClick={() => setShowPhotos((v) => !v)}
            title="Fotos del espacio: elige la que usa el render (img2img)"
          >
            Fotos del espacio
          </Button>
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
            variant="ghost"
            onClick={() => setDoc3D(useCanvasStore.getState().doc)}
            title="Ver el plano de esta zona en 3D navegable"
          >
            Ver en 3D
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
        <CatalogSidebar tool={tool} onPick={setTool} onOpenWizard={() => setShowWizard(true)} />
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
      {showPhotos ? (
        <aside className="absolute right-2 top-12 z-10 w-72 max-w-[calc(100%-1rem)] shadow-lg">
          <ZonePhotosPanel projectId={projectId} zoneId={activeZoneId} />
        </aside>
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
      {doc3D ? (
        <Plan3DOverlay doc={doc3D} projectId={projectId} onClose={() => setDoc3D(null)} />
      ) : null}
      {showWizard ? (
        <SmartWizard
          onSkip={() => setShowWizard(false)}
          onComplete={(doc) => {
            // El doc ya viene amueblado desde el Smart Wizard (paso 3 ejecuta autofurnish).
            // Persistir de inmediato (flush sin debounce) para evitar pérdida si el usuario
            // navega o abre la vista 3D antes del debounce de 800 ms.
            useCanvasStore.getState().load(doc);
            void saveAction(projectId, serializeCanvas(doc));
            setShowWizard(false);
            // Salas no rectangulares: el auto-amueblado interno se omite por diseño.
            if ((doc.floorOutline?.length ?? 0) >= 3) {
              setFurnishNotice(
                `Esta forma se amuebla a mano: añade los muebles desde el catálogo.`,
              );
            } else {
              setFurnishNotice(null);
            }
          }}
        />
      ) : null}
      {furnishNotice ? (
        <div className="absolute bottom-4 left-1/2 z-40 flex max-w-md -translate-x-1/2 items-center gap-3 rounded-card border border-line bg-surface px-3 py-2 text-sm text-ink shadow-lg">
          <span>{furnishNotice}</span>
          <button
            type="button"
            onClick={() => setFurnishNotice(null)}
            aria-label="Cerrar aviso"
            className="text-ink-soft hover:text-ink"
          >
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** ¿La zona no tiene ningún contenido? (objetos, trazos, imagen base ni productos). */
function isDocEmpty(doc: CanvasDoc): boolean {
  return (
    doc.objects.length === 0 &&
    doc.strokes.length === 0 &&
    doc.products.length === 0 &&
    doc.baseImage === null
  );
}

// Compara el contenido PERSISTIBLE (ignora la selección, que es UI efímera) para
// no guardar cuando solo cambió la selección. Incluye escala y altura de techo:
// si no, cambiar solo la escala no dispararía el autosave y se perdería al recargar.
function sameContent(
  a: {
    strokes: unknown;
    objects: unknown;
    products: unknown;
    baseImage: unknown;
    scale?: unknown;
    ceilingHeightM?: unknown;
  },
  b: typeof a,
): boolean {
  return (
    a.strokes === b.strokes &&
    a.objects === b.objects &&
    a.products === b.products &&
    a.baseImage === b.baseImage &&
    a.scale === b.scale &&
    a.ceilingHeightM === b.ceilingHeightM
  );
}
