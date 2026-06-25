'use client';

/**
 * Stage de Konva con todas las capas e interacción. Vive separado del workspace
 * para poder cargarse sin SSR (Konva requiere `window`). Traduce los gestos del
 * puntero según la herramienta activa: dibujar, crear objetos, o marcar una zona.
 */
import { useState, useCallback, useRef } from 'react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '@/canvas/canvas-store';
import { useFreehand } from '@/canvas/use-freehand';
import { useDrawWall } from '@/canvas/use-draw-wall';
import { pixelRectToZone } from '@/canvas/selection-math';
import { GridLayer } from './layers/grid-layer';
import { BackgroundLayer } from './layers/background-layer';
import { StructureLayer } from './layers/structure-layer';
import { ProductLayer } from './layers/product-layer';
import { SelectionOverlay, type MarqueeRect } from './layers/selection-overlay';
import { DrawWallOverlay } from './layers/draw-wall-overlay';
import { OutlineEditorLayer } from './layers/outline-editor-layer';
import { DrawWallLengthInput } from './draw-wall-length-input';
import { FloatingObjectMenu } from './floating-object-menu';
import { selectionAabb, anchorPosition } from '@/canvas/floating-menu-anchor';
import type { Tool } from './canvas-toolbar';
import { CATALOG_BY_KIND } from '@/canvas/catalog';
import { isLight, defaultLight } from '@/canvas/light';
import { isValidScale, catalogSizePx } from '@/canvas/scale';
import { fitToContent } from '@/canvas/fit-view';
import { useWindowEvent } from '@/lib/use-window-event';

interface Props {
  tool: Tool;
  width: number;
  height: number;
  /** Tras crear un objeto se vuelve a 'select' para poder editarlo en el acto. */
  onObjectCreated?: () => void;
  /** Clic derecho: posición en pantalla y si fue sobre un objeto (para el menú). */
  onContextMenu?: (screenX: number, screenY: number, objectId: string | null) => void;
}

// Ids únicos por UUID, no por contador de módulo: un contador arranca en 0 al
// cargar el módulo y, al colocar el primer objeto, generaría `obj-1` chocando con
// objetos ya presentes en el doc cargado (seed/detección usan ese patrón) → keys
// duplicadas en React. El UUID es independiente del contenido del doc.

const MIN_SCALE = 0.2;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.15;

/** Kinds que se enganchan a un muro al colocarse. */
const WALL_CHILD_KINDS = new Set(['door', 'window']);

/**
 * Busca el muro más cercano al punto `worldPt` y, si está dentro del umbral,
 * devuelve la posición/rotación del objeto hijo alineado sobre ese muro.
 * El grosor del objeto se hereda del muro para sellar el hueco visualmente.
 */
function snapToWall(
  worldPt: { x: number; y: number },
  walls: Array<{ x: number; y: number; width: number; height: number; rotation: number }>,
  objWidth: number,
): { x: number; y: number; height: number; rotation: number } | null {
  const SNAP_PX = Math.max(60, (walls[0]?.height ?? 12) * 4);
  let bestDist = SNAP_PX;
  let best: { x: number; y: number; height: number; rotation: number } | null = null;

  for (const wall of walls) {
    const θ = (wall.rotation * Math.PI) / 180;
    const cosθ = Math.cos(θ), sinθ = Math.sin(θ);
    const dx = worldPt.x - wall.x, dy = worldPt.y - wall.y;
    const localX = dx * cosθ + dy * sinθ;
    const localY = -dx * sinθ + dy * cosθ;
    const perpDist = Math.abs(localY - wall.height / 2);
    if (perpDist >= SNAP_PX) continue;
    if (localX < -wall.height || localX > wall.width + wall.height) continue;
    if (perpDist < bestDist) {
      bestDist = perpDist;
      const clamped = Math.max(objWidth / 2, Math.min(wall.width - objWidth / 2, localX));
      // Centro del objeto pegado al eje del muro (local_y = wall.height/2).
      const cx = wall.x + clamped * cosθ + (wall.height / 2) * (-sinθ);
      const cy = wall.y + clamped * sinθ + (wall.height / 2) * cosθ;
      const H = wall.height;
      best = {
        x: cx - (objWidth / 2) * cosθ + (H / 2) * sinθ,
        y: cy - (objWidth / 2) * sinθ - (H / 2) * cosθ,
        height: H,
        rotation: wall.rotation,
      };
    }
  }
  return best;
}

export function CanvasStage({ tool, width, height, onObjectCreated, onContextMenu }: Props) {
  const doc = useCanvasStore((s) => s.doc);
  const addObject = useCanvasStore((s) => s.addObject);
  const setSelection = useCanvasStore((s) => s.setSelection);

  const stageRef = useRef<Konva.Stage>(null);
  const freehand = useFreehand({ color: '#1f1b18', width: 3, enabled: tool === 'freehand' });
  // Dibujo de muros (F7): lee el cursor en coordenadas de MUNDO del stage (zoom/pan).
  const drawWall = useDrawWall({
    enabled: tool === 'draw-wall',
    worldPointer: () => stageRef.current?.getRelativePointerPosition() ?? null,
  });
  // `reset` es estable (useCallback sin deps); se extrae para usarlo en efectos sin
  // re-suscribir cada render (el objeto `drawWall` cambia al variar su `preview`).
  const resetDrawWall = drawWall.reset;
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  // Vista (zoom/pan) del stage. La escala es uniforme; (x,y) es el desplazamiento.
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  // El pan solo se activa con la barra espaciadora (estilo editores de diseño): así
  // arrastrar el fondo SELECCIONA con un marco (marquee) en vez de mover el lienzo.
  const [spaceDown, setSpaceDown] = useState(false);
  // Durante un drag/pan activo se OCULTA el menú flotante (evita recalcular su anclaje
  // en cada frame y reduce ruido visual); reaparece al soltar.
  const [dragging, setDragging] = useState(false);

  // Atajos de teclado globales (sin useEffect directo: el efecto vive en useWindowEvent).
  useWindowEvent('keydown', (e) => {
    if (e.code === 'Space') setSpaceDown(true);
    // Escape termina la cadena de muros en curso (descarta el segmento, conserva los creados)
    // y deselecciona el objeto activo (cierra el menú flotante con teclado).
    if (e.code === 'Escape') {
      resetDrawWall();
      setSelection(null);
    }
  });
  useWindowEvent('keyup', (e) => {
    if (e.code === 'Space') setSpaceDown(false);
  });

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
  useWindowEvent('keydown', (e) => {
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
  });

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

      if (tool === 'draw-wall') {
        drawWall.handlers.onClick();
      } else if (tool === 'freehand') {
        freehand.handlers.onPointerDown(e);
      } else if (catalogEntry) {
        const id = `obj-${globalThis.crypto.randomUUID()}`;
        const scale = isValidScale(doc.scale) ? doc.scale : null;
        const { w, h } = catalogSizePx(catalogEntry, scale);

        let objX = pos.x - w / 2, objY = pos.y - h / 2, objH = h, objRot = 0;
        if (WALL_CHILD_KINDS.has(catalogEntry.kind)) {
          const walls = doc.objects.filter((o) => o.kind === 'wall');
          const snapped = snapToWall(pos, walls, w);
          if (snapped) { objX = snapped.x; objY = snapped.y; objH = snapped.height; objRot = snapped.rotation; }
        }

        addObject({
          id,
          kind: catalogEntry.kind,
          x: objX,
          y: objY,
          width: w,
          height: objH,
          rotation: objRot,
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
      doc.objects,
      freehand.handlers,
      drawWall.handlers,
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
      if (tool === 'draw-wall') {
        drawWall.handlers.onMove();
      } else if (tool === 'freehand') {
        freehand.handlers.onPointerMove(e);
      } else if ((tool === 'zone' || tool === 'select') && marquee) {
        const pos = worldPointer(e.target.getStage());
        if (pos) setMarquee((m) => (m ? { ...m, width: pos.x - m.x, height: pos.y - m.y } : m));
      }
    },
    [tool, marquee, freehand.handlers, drawWall.handlers],
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
      const zone = pixelRectToZone(`zone-${globalThis.crypto.randomUUID()}`, marquee, { width, height });
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

  // Drop de items del catálogo (arrastrados desde el panel lateral).
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('text/catalog')) e.preventDefault();
  };
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData('text/catalog');
      if (!raw) return;
      let parsed: { kind: string; widthM?: number; depthM?: number };
      try { parsed = JSON.parse(raw); } catch { return; }

      const container = stageRef.current?.container();
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const worldX = (e.clientX - rect.left - view.x) / view.scale;
      const worldY = (e.clientY - rect.top - view.y) / view.scale;

      const scale = isValidScale(doc.scale) ? doc.scale : null;
      const builtin = CATALOG_BY_KIND[parsed.kind];
      let w: number, h: number;
      if (builtin) {
        const sz = catalogSizePx(builtin, scale);
        w = sz.w; h = sz.h;
      } else if (parsed.widthM && parsed.depthM) {
        const fallback = { defaultWidth: Math.round(parsed.widthM * 100), defaultHeight: Math.round(parsed.depthM * 100), realWidthM: parsed.widthM, realDepthM: parsed.depthM };
        const sz = catalogSizePx(fallback, scale);
        w = sz.w; h = sz.h;
      } else {
        w = 60; h = 60;
      }

      // Puertas y ventanas se enganchan al muro más cercano, heredando su rotación.
      let finalX = worldX - w / 2, finalY = worldY - h / 2, finalH = h, finalRotation = 0;
      if (WALL_CHILD_KINDS.has(parsed.kind)) {
        const walls = doc.objects.filter((o) => o.kind === 'wall');
        const snapped = snapToWall({ x: worldX, y: worldY }, walls, w);
        if (snapped) { finalX = snapped.x; finalY = snapped.y; finalH = snapped.height; finalRotation = snapped.rotation; }
      }

      const id = `obj-${globalThis.crypto.randomUUID()}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      addObject({ id, kind: parsed.kind as any, x: finalX, y: finalY, width: w, height: finalH, rotation: finalRotation });
      setSelection({ type: 'object', objectIds: [id] });
    },
    [view, doc.scale, doc.objects, addObject, setSelection],
  );

  // Anclaje del menú flotante de acciones: estado DERIVADO de selección + vista +
  // geometría (no un efecto). Solo para selección de objetos, con la herramienta
  // 'select', y oculto durante drag/pan o mientras se dibuja un muro.
  const selectedIds =
    doc.selection?.type === 'object' ? doc.selection.objectIds : [];
  const menuAabb =
    tool === 'select' && !dragging && !drawWall.drawing && selectedIds.length > 0
      ? selectionAabb(doc.objects, selectedIds)
      : null;
  const menuAnchor = menuAabb
    ? anchorPosition(menuAabb, view, { width, height }, { width: 132, height: 32 })
    : null;
  // ¿Todos los objetos seleccionados son muros? Cambia el conjunto de acciones del menú.
  const allWalls =
    selectedIds.length > 0 &&
    selectedIds.every((id) => doc.objects.find((o) => o.id === id)?.kind === 'wall');

  return (
    <div className="relative h-full w-full" onDragOver={handleDragOver} onDrop={handleDrop}>
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
      // Drag de objeto o pan del Stage: ocultar el menú flotante mientras dura.
      onDragStart={() => setDragging(true)}
      onDragEnd={(e) => {
        setDragging(false);
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
      {/* Modo "Editar contorno": handles de los vértices del suelo (capa interactiva propia).
          Solo visible/activa en ese modo, para no interferir con la selección de objetos. */}
      {tool === 'edit-outline' ? (
        <Layer>
          <OutlineEditorLayer />
        </Layer>
      ) : null}
      {/* Una sola capa de overlays efímeros (marquesina + muro en curso): ambos son ligeros y
          no interactivos, así se mantiene el nº de capas de Konva en el máximo recomendado. */}
      <Layer listening={false}>
        <SelectionOverlay marquee={marquee} />
        <DrawWallOverlay preview={drawWall.preview} scale={doc.scale} />
      </Layer>
    </Stage>
      {/* Entrada de longitud exacta del muro en curso (F7.3). */}
      <DrawWallLengthInput visible={tool === 'draw-wall' && drawWall.drawing} onConfirm={drawWall.confirmWithLengthM} />
      {menuAnchor ? (
        <FloatingObjectMenu x={menuAnchor.x} y={menuAnchor.y} ids={selectedIds} allWalls={allWalls} />
      ) : null}
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
