'use client';

/**
 * Capa de objetos del plano (estructura y mobiliario). Cada objeto se dibuja con
 * su forma vectorial en planta y es seleccionable; el seleccionado recibe un
 * `Transformer` para moverlo, redimensionarlo y rotarlo. Al pasar el ratón se
 * muestra su nombre (para saber qué es cada elemento). Los cambios geométricos se
 * confían al store (con historial).
 */
import { useMemo, useRef, useState } from 'react';
import { Layer, Group, Rect, Transformer, Label, Tag, Text } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '@/canvas/canvas-store';
import type { StructObj } from '@/canvas/types';
import { CATALOG_BY_KIND } from '@/canvas/catalog';
import { objectShape } from '../object-shapes';
import { snap } from './grid-layer';
import { selectionAabb, type WorldRect } from '@/canvas/floating-menu-anchor';
import { formatObjectSize, isValidScale } from '@/canvas/scale';
import { LiveDimensionOverlay, type LiveDimension } from './live-dimension-overlay';
import { useTransformerNodes } from '@/canvas/use-transformer-nodes';

export function StructureLayer({ objects }: { objects: StructObj[] }) {
  const selection = useCanvasStore((s) => s.doc.selection);
  const setSelection = useCanvasStore((s) => s.setSelection);
  const updateObject = useCanvasStore((s) => s.updateObject);
  const scale = useCanvasStore((s) => s.doc.scale);

  const trRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  // Cota en vivo durante el gesto (estado transitorio; NO toca el store por frame).
  const [live, setLive] = useState<LiveDimension | null>(null);
  // AABB de los vecinos (los NO seleccionados), precalculados en onDragStart para no
  // recalcularlos en cada frame del arrastre (solo cambia el AABB del objeto movido).
  const neighborsRef = useRef<WorldRect[]>([]);
  // Posición del objeto arrastrado al empezar, para calcular el delta y arrastrar
  // con él al resto de la selección (mover varios a la vez con el ratón).
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const selectedIds = useMemo(
    () => (selection?.type === 'object' ? selection.objectIds : []),
    [selection],
  );

  // Sincroniza el Transformer con los nodos seleccionados (sin useEffect directo).
  useTransformerNodes(trRef, layerRef, selectedIds, objects);

  // Resuelve a qué ids afecta un clic en `id`: si el objeto pertenece a un grupo,
  // se selecciona TODO el grupo; si no, solo ese objeto.
  const idsForClick = (id: string): string[] => {
    const obj = objects.find((o) => o.id === id);
    if (obj?.groupId) return objects.filter((o) => o.groupId === obj.groupId).map((o) => o.id);
    return [id];
  };

  // Clic en un objeto: lo selecciona (o su grupo); con Shift, lo añade/quita.
  const onObjectClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>, id: string) => {
    const shift = 'shiftKey' in e.evt ? e.evt.shiftKey : false;
    const clickIds = idsForClick(id);
    if (!shift) {
      setSelection({ type: 'object', objectIds: clickIds });
      return;
    }
    const current = selection?.type === 'object' ? selection.objectIds : [];
    const allIncluded = clickIds.every((x) => current.includes(x));
    const next = allIncluded
      ? current.filter((x) => !clickIds.includes(x))
      : [...new Set([...current, ...clickIds])];
    setSelection(next.length ? { type: 'object', objectIds: next } : null);
  };

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
          onClick={(e) => onObjectClick(e, o.id)}
          onTap={(e) => onObjectClick(e, o.id)}
          onMouseEnter={(e) => {
            setHovered(o.id);
            setCursor(e, 'move');
          }}
          onMouseLeave={(e) => {
            setHovered((h) => (h === o.id ? null : h));
            setCursor(e, 'default');
          }}
          onDragStart={() => {
            dragStart.current = { x: o.x, y: o.y };
            // Precalcular los AABB de los vecinos (NO seleccionados) una sola vez.
            const sel = new Set(selectedIds.length ? selectedIds : [o.id]);
            neighborsRef.current = objects
              .filter((obj) => !sel.has(obj.id))
              .map((obj) => selectionAabb([obj], [obj.id]))
              .filter((r): r is WorldRect => r !== null);
          }}
          onDragMove={(e) => {
            // AABB actual del objeto arrastrado (su rect en la posición del nodo;
            // rotación incluida vía las dimensiones rotadas del objeto).
            const aabb = selectionAabb(
              [{ ...o, x: e.target.x(), y: e.target.y() }],
              [o.id],
            );
            if (aabb) setLive({ kind: 'move', rect: aabb, others: neighborsRef.current });
          }}
          onDragEnd={(e) => {
            setLive(null);
            const nx = snap(e.target.x());
            const ny = snap(e.target.y());
            const others = selectedIds.filter((id) => id !== o.id);
            // Si el objeto arrastrado forma parte de una multiselección, el resto se
            // desplaza el mismo delta (mover varios a la vez con el ratón).
            if (others.length && dragStart.current) {
              const dx = nx - dragStart.current.x;
              const dy = ny - dragStart.current.y;
              for (const obj of objects) {
                if (selectedIds.includes(obj.id)) {
                  updateObject(
                    obj.id,
                    obj.id === o.id
                      ? { x: nx, y: ny }
                      : { x: snap(obj.x + dx), y: snap(obj.y + dy) },
                  );
                }
              }
            } else {
              updateObject(o.id, { x: nx, y: ny });
            }
            dragStart.current = null;
          }}
          onTransform={(e) => {
            // Cota de TAMAÑO en vivo durante el resize: tamaño actual = tamaño del
            // objeto × la escala que el Transformer va aplicando al nodo.
            if (!isValidScale(scale)) return;
            const node = e.target;
            const w = Math.max(8, o.width * node.scaleX());
            const h = Math.max(8, o.height * node.scaleY());
            const rect = selectionAabb(
              [{ ...o, x: node.x(), y: node.y(), width: w, height: h, rotation: node.rotation() }],
              [o.id],
            );
            if (rect) {
              setLive({
                kind: 'resize',
                rect,
                others: [],
                sizeLabel: formatObjectSize({ width: w, height: h, rotation: node.rotation() }, scale),
              });
            }
          }}
          onTransformEnd={(e) => {
            setLive(null);
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
          {objectShape(o.kind, o.width, o.height, o.flipX === true, o.light?.color)}
          {/* Resalte individual de los objetos seleccionados, para distinguir cuáles
              están en la selección (el Transformer dibuja solo el recuadro conjunto). */}
          {selectedIds.includes(o.id) ? (
            <Rect
              width={o.width}
              height={o.height}
              stroke="#b5532f"
              strokeWidth={2}
              dash={[6, 4]}
              listening={false}
            />
          ) : null}
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

      {/* Cota en vivo del gesto en curso (mover → huecos; resize → tamaño). */}
      <LiveDimensionOverlay live={live} scale={scale} />

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
