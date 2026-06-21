'use client';

/**
 * Capa de objetos del plano (estructura y mobiliario). Cada objeto se dibuja con
 * su forma vectorial en planta y es seleccionable; el seleccionado recibe un
 * `Transformer` para moverlo, redimensionarlo y rotarlo. Al pasar el ratón se
 * muestra su nombre (para saber qué es cada elemento). Los cambios geométricos se
 * confían al store (con historial).
 */
import { useEffect, useRef, useState } from 'react';
import { Layer, Group, Rect, Transformer, Label, Tag, Text } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '@/canvas/canvas-store';
import type { StructObj } from '@/canvas/types';
import { CATALOG_BY_KIND } from '@/canvas/catalog';
import { objectShape } from '../object-shapes';
import { snap } from './grid-layer';

export function StructureLayer({ objects }: { objects: StructObj[] }) {
  const selection = useCanvasStore((s) => s.doc.selection);
  const setSelection = useCanvasStore((s) => s.setSelection);
  const updateObject = useCanvasStore((s) => s.updateObject);

  const trRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const selectedId = selection?.type === 'object' ? selection.objectId : null;

  useEffect(() => {
    const tr = trRef.current;
    const layer = layerRef.current;
    if (!tr || !layer) return;
    const node = selectedId ? layer.findOne(`#${selectedId}`) : null;
    tr.nodes(node ? [node] : []);
  }, [selectedId, objects]);

  // Cambia el cursor a "mano" sobre un objeto para indicar que es interactivo.
  const setCursor = (e: Konva.KonvaEventObject<MouseEvent>, cursor: string) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = cursor;
  };

  const hoveredObj = objects.find((o) => o.id === hovered);

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
          onMouseEnter={(e) => {
            setHovered(o.id);
            setCursor(e, 'move');
          }}
          onMouseLeave={(e) => {
            setHovered((h) => (h === o.id ? null : h));
            setCursor(e, 'default');
          }}
          onDragEnd={(e) => updateObject(o.id, { x: snap(e.target.x()), y: snap(e.target.y()) })}
          onTransformEnd={(e) => {
            const node = e.target;
            // El Group no expone un width/height intrínseco fiable: se parte del
            // tamaño conocido del objeto y se le aplica la escala del transform.
            // Posición y tamaño se ajustan a la rejilla.
            updateObject(o.id, {
              x: snap(node.x()),
              y: snap(node.y()),
              width: Math.max(8, snap(o.width * node.scaleX())),
              height: Math.max(8, snap(o.height * node.scaleY())),
              rotation: node.rotation(),
            });
            node.scaleX(1);
            node.scaleY(1);
          }}
        >
          {/* Fondo transparente: da al Group un área de captura/transform estable. */}
          <Rect width={o.width} height={o.height} fill="transparent" />
          {/* Espejo horizontal: cada primitiva de la forma se dibuja con su X
              reflejada respecto al ancho. Se hace en el modelo de la forma (no con
              un Group scaleX anidado, que no compensaba bien dentro del Group que
              además rota). */}
          {objectShape(o.kind, o.width, o.height, o.flipX === true)}
        </Group>
      ))}

      {/* Etiqueta flotante con el nombre del objeto bajo el ratón. */}
      {hoveredObj ? (
        <Label x={hoveredObj.x} y={hoveredObj.y - 22} listening={false}>
          <Tag fill="#3a322e" cornerRadius={3} />
          <Text
            text={CATALOG_BY_KIND[hoveredObj.kind]?.label ?? hoveredObj.kind}
            fontSize={12}
            padding={4}
            fill="#fff"
          />
        </Label>
      ) : null}

      <Transformer
        ref={trRef}
        rotateEnabled
        rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
        rotationSnapTolerance={8}
        flipEnabled={false}
        anchorSize={10}
        anchorStroke="#b5532f"
        anchorFill="#fff"
        borderStroke="#b5532f"
        // El tirador de rotación, más separado y visible, para girar desde fuera
        // de la esquina superior del objeto.
        rotateAnchorOffset={28}
      />
    </Layer>
  );
}
