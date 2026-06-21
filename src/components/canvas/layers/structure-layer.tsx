'use client';

/**
 * Capa de objetos del plano (estructura y mobiliario). Cada objeto se dibuja con
 * su forma vectorial en planta y es seleccionable; el seleccionado recibe un
 * `Transformer` para moverlo, redimensionarlo y rotarlo. Los cambios geométricos
 * se confían al store (con historial).
 */
import { useEffect, useRef } from 'react';
import { Layer, Group, Rect, Transformer } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '@/canvas/canvas-store';
import type { StructObj } from '@/canvas/types';
import { objectShape } from '../object-shapes';

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
        <Group
          key={o.id}
          id={o.id}
          x={o.x}
          y={o.y}
          width={o.width}
          height={o.height}
          rotation={o.rotation}
          draggable
          onClick={() => setSelection({ type: 'object', objectId: o.id })}
          onTap={() => setSelection({ type: 'object', objectId: o.id })}
          onDragEnd={(e) => updateObject(o.id, { x: e.target.x(), y: e.target.y() })}
          onTransformEnd={(e) => {
            const node = e.target;
            // El Group no expone un width/height intrínseco fiable: se parte del
            // tamaño conocido del objeto y se le aplica la escala del transform.
            updateObject(o.id, {
              x: node.x(),
              y: node.y(),
              width: Math.max(8, o.width * node.scaleX()),
              height: Math.max(8, o.height * node.scaleY()),
              rotation: node.rotation(),
            });
            node.scaleX(1);
            node.scaleY(1);
          }}
        >
          {/* Fondo transparente: da al Group un área de captura/transform estable. */}
          <Rect width={o.width} height={o.height} fill="transparent" />
          {objectShape(o.kind, o.width, o.height)}
        </Group>
      ))}
      <Transformer ref={trRef} rotateEnabled flipEnabled={false} />
    </Layer>
  );
}
