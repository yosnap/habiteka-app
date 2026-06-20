'use client';

/**
 * Capa de objetos estructurales (muros/ventanas/puertas). Cada objeto es
 * seleccionable; el seleccionado recibe un `Transformer` para moverlo y
 * redimensionarlo. Los cambios geométricos se confían al store (con historial).
 */
import { useEffect, useRef } from 'react';
import { Layer, Rect, Transformer } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '@/canvas/canvas-store';
import type { StructObj, StructKind } from '@/canvas/types';

// Color por tipo (referencia a la familia de tokens; valores resueltos por CSS
// no aplican en canvas, así que se mapean los equivalentes del design system).
const FILL: Record<StructKind, string> = {
  wall: '#7a5c4f',
  window: '#7aa7c7',
  door: '#c78b5c',
};

export function StructureLayer({ objects }: { objects: StructObj[] }) {
  const selection = useCanvasStore((s) => s.doc.selection);
  const setSelection = useCanvasStore((s) => s.setSelection);
  const updateObject = useCanvasStore((s) => s.updateObject);

  const trRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);

  const selectedId = selection?.type === 'object' ? selection.objectId : null;

  useEffect(() => {
    const tr = trRef.current;
    const layer = layerRef.current;
    if (!tr || !layer) return;
    const node = selectedId ? layer.findOne(`#${selectedId}`) : null;
    tr.nodes(node ? [node] : []);
  }, [selectedId, objects]);

  return (
    <Layer ref={layerRef}>
      {objects.map((o) => (
        <Rect
          key={o.id}
          id={o.id}
          x={o.x}
          y={o.y}
          width={o.width}
          height={o.height}
          rotation={o.rotation}
          fill={FILL[o.kind]}
          cornerRadius={2}
          draggable
          onClick={() => setSelection({ type: 'object', objectId: o.id })}
          onTap={() => setSelection({ type: 'object', objectId: o.id })}
          onDragEnd={(e) => updateObject(o.id, { x: e.target.x(), y: e.target.y() })}
          onTransformEnd={(e) => {
            const node = e.target;
            updateObject(o.id, {
              x: node.x(),
              y: node.y(),
              width: Math.max(5, node.width() * node.scaleX()),
              height: Math.max(5, node.height() * node.scaleY()),
              rotation: node.rotation(),
            });
            node.scaleX(1);
            node.scaleY(1);
          }}
        />
      ))}
      <Transformer ref={trRef} rotateEnabled flipEnabled={false} />
    </Layer>
  );
}
