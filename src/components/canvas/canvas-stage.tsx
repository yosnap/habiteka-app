'use client';

/**
 * Stage de Konva con todas las capas e interacción. Vive separado del workspace
 * para poder cargarse sin SSR (Konva requiere `window`). Traduce los gestos del
 * puntero según la herramienta activa: dibujar, crear objetos, o marcar una zona.
 */
import { useState, useCallback } from 'react';
import { Stage } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '@/canvas/canvas-store';
import { useFreehand } from '@/canvas/use-freehand';
import { pixelRectToZone } from '@/canvas/selection-math';
import { BaseImageLayer } from './layers/base-image-layer';
import { FreehandLayer } from './layers/freehand-layer';
import { StructureLayer } from './layers/structure-layer';
import { ProductLayer } from './layers/product-layer';
import { SelectionOverlay, type MarqueeRect } from './layers/selection-overlay';
import type { Tool } from './canvas-toolbar';
import type { StructKind } from '@/canvas/types';

interface Props {
  tool: Tool;
  width: number;
  height: number;
  /** Tras crear un objeto se vuelve a 'select' para poder editarlo en el acto. */
  onObjectCreated?: () => void;
}

let objectSeq = 0;
let zoneSeq = 0;

export function CanvasStage({ tool, width, height, onObjectCreated }: Props) {
  const doc = useCanvasStore((s) => s.doc);
  const addObject = useCanvasStore((s) => s.addObject);
  const setSelection = useCanvasStore((s) => s.setSelection);

  const freehand = useFreehand({ color: '#1f1b18', width: 3, enabled: tool === 'freehand' });
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);

  const isStructTool = tool === 'wall' || tool === 'window' || tool === 'door';

  const onPointerDown = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (!pos) return;

      if (tool === 'select') {
        // Un clic en el fondo (el propio Stage) deselecciona; el clic sobre un
        // objeto lo gestiona la capa (selecciona sin pasar por aquí).
        if (e.target === stage) setSelection(null);
        return;
      }

      if (tool === 'freehand') {
        freehand.handlers.onPointerDown(e);
      } else if (isStructTool) {
        objectSeq += 1;
        const id = `obj-${objectSeq}`;
        addObject({
          id,
          kind: tool as StructKind,
          x: pos.x,
          y: pos.y,
          width: tool === 'wall' ? 120 : 60,
          height: tool === 'wall' ? 12 : 40,
          rotation: 0,
        });
        // Crear es una acción puntual: se selecciona el nuevo objeto y se vuelve a
        // 'select' para poder moverlo/redimensionarlo sin crear más al hacer clic.
        setSelection({ type: 'object', objectId: id });
        onObjectCreated?.();
      } else if (tool === 'zone') {
        setMarquee({ x: pos.x, y: pos.y, width: 0, height: 0 });
      }
    },
    [tool, isStructTool, freehand.handlers, addObject, setSelection, onObjectCreated],
  );

  const onPointerMove = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      if (tool === 'freehand') {
        freehand.handlers.onPointerMove(e);
      } else if (tool === 'zone' && marquee) {
        const pos = e.target.getStage()?.getPointerPosition();
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

  return (
    <Stage
      width={width}
      height={height}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <BaseImageLayer baseImage={doc.baseImage} stageWidth={width} stageHeight={height} />
      <FreehandLayer strokes={doc.strokes} draft={freehand.draft} />
      <StructureLayer objects={doc.objects} />
      <ProductLayer products={doc.products} />
      <SelectionOverlay marquee={marquee} />
    </Stage>
  );
}
