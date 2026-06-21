'use client';

/**
 * Stage de Konva con todas las capas e interacción. Vive separado del workspace
 * para poder cargarse sin SSR (Konva requiere `window`). Traduce los gestos del
 * puntero según la herramienta activa: dibujar, crear objetos, o marcar una zona.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Stage } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '@/canvas/canvas-store';
import { useFreehand } from '@/canvas/use-freehand';
import { pixelRectToZone } from '@/canvas/selection-math';
import { GridLayer } from './layers/grid-layer';
import { BackgroundLayer } from './layers/background-layer';
import { StructureLayer } from './layers/structure-layer';
import { ProductLayer } from './layers/product-layer';
import { SelectionOverlay, type MarqueeRect } from './layers/selection-overlay';
import type { Tool } from './canvas-toolbar';
import { CATALOG_BY_KIND } from '@/canvas/catalog';
import { isLight, defaultLight } from '@/canvas/light';
import { isValidScale, catalogSizePx } from '@/canvas/scale';
import { fitToContent } from '@/canvas/fit-view';

interface Props {
  tool: Tool;
  width: number;
  height: number;
  /** Tras crear un objeto se vuelve a 'select' para poder editarlo en el acto. */
  onObjectCreated?: () => void;
  /** Clic derecho: posición en pantalla y si fue sobre un objeto (para el menú). */
  onContextMenu?: (screenX: number, screenY: number, objectId: string | null) => void;
}

let objectSeq = 0;
let zoneSeq = 0;

const MIN_SCALE = 0.2;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.15;

export function CanvasStage({ tool, width, height, onObjectCreated, onContextMenu }: Props) {
  const doc = useCanvasStore((s) => s.doc);
  const addObject = useCanvasStore((s) => s.addObject);
  const setSelection = useCanvasStore((s) => s.setSelection);

  const stageRef = useRef<Konva.Stage>(null);
  const freehand = useFreehand({ color: '#1f1b18', width: 3, enabled: tool === 'freehand' });
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  // Vista (zoom/pan) del stage. La escala es uniforme; (x,y) es el desplazamiento.
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  // El pan solo se activa con la barra espaciadora (estilo editores de diseño): así
  // arrastrar el fondo SELECCIONA con un marco (marquee) en vez de mover el lienzo.
  const [spaceDown, setSpaceDown] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Es herramienta de creación de objeto si el tool es un kind del catálogo.
  const catalogEntry = tool in CATALOG_BY_KIND ? CATALOG_BY_KIND[tool] : undefined;

  // Aplica un zoom manteniendo fijo el punto `center` (en píxeles de pantalla).
  const zoomTo = useCallback((nextScale: number, center: { x: number; y: number }) => {
    setView((v) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
      // Mundo bajo el cursor antes del zoom; se recoloca para que no se mueva.
      const worldX = (center.x - v.x) / v.scale;
      const worldY = (center.y - v.y) / v.scale;
      return { scale, x: center.x - worldX * scale, y: center.y - worldY * scale };
    });
  }, []);

  // Atajos de zoom por teclado: Ctrl/Cmd + (+, -, 0). El + y - hacen zoom al centro.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const center = { x: width / 2, y: height / 2 };
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomTo(view.scale * ZOOM_STEP, center);
      } else if (e.key === '-') {
        e.preventDefault();
        zoomTo(view.scale / ZOOM_STEP, center);
      } else if (e.key === '0') {
        e.preventDefault();
        setView({ scale: 1, x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view.scale, width, height, zoomTo]);

  // Zoom con la rueda, centrado en el cursor.
  const onWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      const pointer = stage?.getPointerPosition();
      if (!pointer) return;
      const factor = e.evt.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      zoomTo(view.scale * factor, pointer);
    },
    [view.scale, zoomTo],
  );

  // Coordenada de mundo (espacio del documento) bajo el cursor, considerando zoom/pan.
  const worldPointer = (stage: Konva.Stage | null) => {
    return stage?.getRelativePointerPosition() ?? null;
  };

  const onPointerDown = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      const stage = e.target.getStage();
      // Modo Mover: el arrastre lo gestiona `draggable` del Stage; no crea ni
      // selecciona nada aquí.
      if (tool === 'pan' || spaceDown) return;
      // Modo Zoom: clic acerca (Shift+clic aleja) centrado en el punto pulsado.
      if (tool === 'zoom') {
        const pointer = stage?.getPointerPosition();
        if (pointer) zoomTo(view.scale * (e.evt.shiftKey ? 1 / ZOOM_STEP : ZOOM_STEP), pointer);
        return;
      }
      const pos = worldPointer(stage);
      if (!pos) return;

      if (tool === 'select') {
        // Con espacio se panea (el Stage es draggable); sin espacio, arrastrar el
        // fondo dibuja un marco de selección. Un clic simple en vacío deselecciona.
        if (e.target === stage && !spaceDown) {
          setSelection(null);
          setMarquee({ x: pos.x, y: pos.y, width: 0, height: 0 });
        }
        return;
      }

      if (tool === 'freehand') {
        freehand.handlers.onPointerDown(e);
      } else if (catalogEntry) {
        objectSeq += 1;
        const id = `obj-${objectSeq}`;
        // Con escala activa, el objeto nace con sus MEDIDAS REALES del catálogo
        // convertidas a px (una puerta de 0,9 m, no "lo que midan 60 px"). Sin
        // escala, usa el tamaño en px por defecto. Lógica pura en `catalogSizePx`.
        const scale = isValidScale(doc.scale) ? doc.scale : null;
        const { w, h } = catalogSizePx(catalogEntry, scale);
        // Se coloca centrado en el punto pulsado (en coordenadas de mundo).
        addObject({
          id,
          kind: catalogEntry.kind,
          x: pos.x - w / 2,
          y: pos.y - h / 2,
          width: w,
          height: h,
          rotation: 0,
          // Las luces de primera clase nacen con sus atributos por defecto.
          ...(isLight(catalogEntry.kind) ? { light: defaultLight() } : {}),
        });
        setSelection({ type: 'object', objectIds: [id] });
        onObjectCreated?.();
      } else if (tool === 'zone') {
        setMarquee({ x: pos.x, y: pos.y, width: 0, height: 0 });
      }
    },
    [
      tool,
      catalogEntry,
      doc.scale,
      freehand.handlers,
      addObject,
      setSelection,
      onObjectCreated,
      spaceDown,
      zoomTo,
      view.scale,
    ],
  );

  const onPointerMove = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      if (tool === 'freehand') {
        freehand.handlers.onPointerMove(e);
      } else if ((tool === 'zone' || tool === 'select') && marquee) {
        const pos = worldPointer(e.target.getStage());
        if (pos) setMarquee((m) => (m ? { ...m, width: pos.x - m.x, height: pos.y - m.y } : m));
      }
    },
    [tool, marquee, freehand.handlers],
  );

  const onPointerUp = useCallback(() => {
    if (tool === 'freehand') {
      freehand.handlers.onPointerUp();
    } else if (tool === 'select' && marquee) {
      // Selección por marco: todos los objetos cuyo rectángulo intersecta el marco.
      // Un marco mínimo (clic sin arrastrar) no selecciona nada (ya deseleccionó).
      const r = normalizeRect(marquee);
      if (r.width > 3 || r.height > 3) {
        const ids = doc.objects.filter((o) => intersects(r, o)).map((o) => o.id);
        setSelection(ids.length ? { type: 'object', objectIds: ids } : null);
      }
      setMarquee(null);
    } else if (tool === 'zone' && marquee) {
      zoneSeq += 1;
      const zone = pixelRectToZone(`zone-${zoneSeq}`, marquee, { width, height });
      const bbox = zone.bbox;
      if (bbox) {
        setSelection({
          type: 'zone',
          x: bbox.x,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height,
        });
      }
      setMarquee(null);
    }
  }, [tool, marquee, freehand.handlers, width, height, setSelection, doc.objects]);

  // El pan (arrastrar el lienzo) se activa con la barra espaciadora O en modo Mover.
  const panEnabled = spaceDown || tool === 'pan';

  // Acciones de los controles de vista (zoom +/−, ajustar a pantalla, 100 %).
  const center = { x: width / 2, y: height / 2 };
  const zoomIn = () => zoomTo(view.scale * ZOOM_STEP, center);
  const zoomOut = () => zoomTo(view.scale / ZOOM_STEP, center);
  const resetView = () => setView({ scale: 1, x: 0, y: 0 });
  const fitView = () =>
    setView(fitToContent(doc.objects, width, height, { minScale: MIN_SCALE, maxScale: MAX_SCALE }));

  return (
    <div className="relative h-full w-full">
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      scaleX={view.scale}
      scaleY={view.scale}
      x={view.x}
      y={view.y}
      draggable={panEnabled}
      onWheel={onWheel}
      onDragEnd={(e) => {
        // El pan mueve el PROPIO Stage. El drag de un objeto burbujea hasta aquí,
        // pero su target es el objeto (no el Stage): se ignora para no pisar su
        // posición ni el pan.
        if (e.target === e.target.getStage()) {
          setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
        }
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={(e) => {
        e.evt.preventDefault();
        const stage = e.target.getStage();
        // Sube por la jerarquía hasta el Group del objeto (que lleva el id).
        let node: Konva.Node | null = e.target;
        let objectId: string | null = null;
        while (node && node !== stage) {
          const id = node.id();
          if (id && doc.objects.some((o) => o.id === id)) {
            objectId = id;
            break;
          }
          node = node.getParent();
        }
        // Si el objeto del clic no estaba seleccionado, se selecciona solo él.
        if (objectId) {
          const sel = doc.selection;
          const already = sel?.type === 'object' && sel.objectIds.includes(objectId);
          if (!already) setSelection({ type: 'object', objectIds: [objectId] });
        }
        onContextMenu?.(e.evt.clientX, e.evt.clientY, objectId);
      }}
    >
      <GridLayer
        width={width}
        height={height}
        scale={view.scale}
        offsetX={view.x}
        offsetY={view.y}
      />
      <BackgroundLayer
        baseImage={doc.baseImage}
        stageWidth={width}
        stageHeight={height}
        strokes={doc.strokes}
        draft={freehand.draft}
      />
      <StructureLayer objects={doc.objects} />
      <ProductLayer products={doc.products} />
      <SelectionOverlay marquee={marquee} />
    </Stage>
      {/* Controles de vista flotantes (overlay HTML sobre el Stage de Konva). */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-control border border-line bg-surface/90 p-1 shadow-sm">
        <button type="button" onClick={zoomOut} aria-label="Alejar" className="text-ink hover:bg-canvas h-6 w-6 rounded-control text-sm">
          −
        </button>
        <span className="text-ink-soft w-10 text-center text-xs tabular-nums">
          {Math.round(view.scale * 100)}%
        </span>
        <button type="button" onClick={zoomIn} aria-label="Acercar" className="text-ink hover:bg-canvas h-6 w-6 rounded-control text-sm">
          +
        </button>
        <span className="bg-border mx-0.5 h-4 w-px" aria-hidden />
        <button type="button" onClick={fitView} aria-label="Ajustar a pantalla" title="Ajustar el plano a la pantalla" className="text-ink-soft hover:bg-canvas hover:text-ink rounded-control px-1.5 text-xs">
          Ajustar
        </button>
        <button type="button" onClick={resetView} aria-label="Vista 100%" title="Restablecer la vista al 100%" className="text-ink-soft hover:bg-canvas hover:text-ink rounded-control px-1.5 text-xs">
          100%
        </button>
      </div>
    </div>
  );
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Normaliza un rectángulo (que puede tener ancho/alto negativos) a x/y arriba-izq. */
function normalizeRect(r: Rect): Rect {
  return {
    x: Math.min(r.x, r.x + r.width),
    y: Math.min(r.y, r.y + r.height),
    width: Math.abs(r.width),
    height: Math.abs(r.height),
  };
}

/** true si el marco `r` intersecta el rectángulo del objeto `o` (AABB). */
function intersects(r: Rect, o: { x: number; y: number; width: number; height: number }): boolean {
  return r.x < o.x + o.width && r.x + r.width > o.x && r.y < o.y + o.height && r.y + r.height > o.y;
}
