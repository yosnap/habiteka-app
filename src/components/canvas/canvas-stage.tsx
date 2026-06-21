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
import { BaseImageLayer } from './layers/base-image-layer';
import { FreehandLayer } from './layers/freehand-layer';
import { StructureLayer } from './layers/structure-layer';
import { ProductLayer } from './layers/product-layer';
import { SelectionOverlay, type MarqueeRect } from './layers/selection-overlay';
import type { Tool } from './canvas-toolbar';
import { CATALOG_BY_KIND } from '@/canvas/catalog';

interface Props {
  tool: Tool;
  width: number;
  height: number;
  /** Tras crear un objeto se vuelve a 'select' para poder editarlo en el acto. */
  onObjectCreated?: () => void;
}

let objectSeq = 0;
let zoneSeq = 0;

const MIN_SCALE = 0.2;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.15;

export function CanvasStage({ tool, width, height, onObjectCreated }: Props) {
  const doc = useCanvasStore((s) => s.doc);
  const addObject = useCanvasStore((s) => s.addObject);
  const setSelection = useCanvasStore((s) => s.setSelection);

  const stageRef = useRef<Konva.Stage>(null);
  const freehand = useFreehand({ color: '#1f1b18', width: 3, enabled: tool === 'freehand' });
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  // Vista (zoom/pan) del stage. La escala es uniforme; (x,y) es el desplazamiento.
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });

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
      const pos = worldPointer(stage);
      if (!pos) return;

      if (tool === 'select') {
        if (e.target === stage) setSelection(null);
        return;
      }

      if (tool === 'freehand') {
        freehand.handlers.onPointerDown(e);
      } else if (catalogEntry) {
        objectSeq += 1;
        const id = `obj-${objectSeq}`;
        // Se coloca centrado en el punto pulsado (en coordenadas de mundo).
        addObject({
          id,
          kind: catalogEntry.kind,
          x: pos.x - catalogEntry.defaultWidth / 2,
          y: pos.y - catalogEntry.defaultHeight / 2,
          width: catalogEntry.defaultWidth,
          height: catalogEntry.defaultHeight,
          rotation: 0,
        });
        setSelection({ type: 'object', objectIds: [id] });
        onObjectCreated?.();
      } else if (tool === 'zone') {
        setMarquee({ x: pos.x, y: pos.y, width: 0, height: 0 });
      }
    },
    [tool, catalogEntry, freehand.handlers, addObject, setSelection, onObjectCreated],
  );

  const onPointerMove = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      if (tool === 'freehand') {
        freehand.handlers.onPointerMove(e);
      } else if (tool === 'zone' && marquee) {
        const pos = worldPointer(e.target.getStage());
        if (pos) setMarquee((m) => (m ? { ...m, width: pos.x - m.x, height: pos.y - m.y } : m));
      }
    },
    [tool, marquee, freehand.handlers],
  );

  const onPointerUp = useCallback(() => {
    if (tool === 'freehand') {
      freehand.handlers.onPointerUp();
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
  }, [tool, marquee, freehand.handlers, width, height, setSelection]);

  // Pan: arrastrar el FONDO del lienzo (no un objeto) desplaza la vista. Solo con
  // la herramienta de selección, para no interferir con dibujar/crear.
  const panEnabled = tool === 'select';

  return (
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
      onDragStart={(e) => {
        // Solo paneamos si el arrastre empezó en el fondo, no sobre un objeto.
        if (e.target !== e.target.getStage()) e.target.stopDrag();
      }}
      onDragEnd={(e) => {
        if (e.target === e.target.getStage()) {
          setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
        }
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <GridLayer
        width={width}
        height={height}
        scale={view.scale}
        offsetX={view.x}
        offsetY={view.y}
      />
      <BaseImageLayer baseImage={doc.baseImage} stageWidth={width} stageHeight={height} />
      <FreehandLayer strokes={doc.strokes} draft={freehand.draft} />
      <StructureLayer objects={doc.objects} />
      <ProductLayer products={doc.products} />
      <SelectionOverlay marquee={marquee} />
    </Stage>
  );
}
