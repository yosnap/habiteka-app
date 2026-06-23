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
import { computeSnap, wallStretchToClose, type SnapResult } from '@/canvas/snap';
import { formatObjectSize, isValidScale } from '@/canvas/scale';
import { LiveDimensionOverlay, type LiveDimension } from './live-dimension-overlay';
import { SnapGuidesOverlay } from './snap-guides-overlay';
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
  // Líneas-guía del snap en curso (coords de mundo), para dibujarlas durante el arrastre.
  const [guides, setGuides] = useState<SnapResult | null>(null);
  // ¿El snap está desactivado temporalmente? (tecla Alt mantenida durante el arrastre). Es un
  // ref porque `dragBoundFunc` se ejecuta fuera del ciclo de render y necesita el valor vivo.
  const snapDisabled = useRef(false);
  // Tamaño (w,h) del objeto que se está arrastrando, para construir su AABB en dragBoundFunc.
  const draggingSize = useRef<{ width: number; height: number } | null>(null);

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
          dragBoundFunc={function (this: Konva.Node, pos) {
            // pos es ABSOLUTA (coords de stage). Con Alt mantenido o sin escala usable,
            // no se aplica magnetismo: la rejilla del onDragEnd hace de fallback.
            if (snapDisabled.current) return pos;
            const layer = layerRef.current;
            const size = draggingSize.current;
            if (!layer || !size) return pos;
            // Absoluto → mundo (coords del documento/layer): la esquina del objeto.
            const inv = layer.getAbsoluteTransform().copy().invert();
            const world = inv.point(pos);
            // AABB del objeto en esa posición (respeta su rotación), contra los vecinos.
            const aabb = selectionAabb(
              [{ ...o, x: world.x, y: world.y, width: size.width, height: size.height }],
              [o.id],
            );
            if (!aabb) return pos;
            const result = computeSnap(aabb, neighborsRef.current);
            if (result.dx === 0 && result.dy === 0) return pos;
            // Aplicar el enganche en mundo y reconvertir a absoluto para Konva.
            const snappedWorld = { x: world.x + result.dx, y: world.y + result.dy };
            return layer.getAbsoluteTransform().point(snappedWorld);
          }}
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
          onDragStart={(e) => {
            dragStart.current = { x: o.x, y: o.y };
            draggingSize.current = { width: o.width, height: o.height };
            snapDisabled.current = 'altKey' in e.evt ? e.evt.altKey : false;
            // Precalcular los AABB de los vecinos (NO seleccionados) una sola vez.
            const sel = new Set(selectedIds.length ? selectedIds : [o.id]);
            neighborsRef.current = objects
              .filter((obj) => !sel.has(obj.id))
              .map((obj) => selectionAabb([obj], [obj.id]))
              .filter((r): r is WorldRect => r !== null);
          }}
          onDragMove={(e) => {
            // Mantener vivo el estado de Alt (puede pulsarse/soltarse durante el arrastre).
            snapDisabled.current = 'altKey' in e.evt ? e.evt.altKey : false;
            // AABB actual del objeto arrastrado (su rect en la posición del nodo, ya
            // enganchada por dragBoundFunc; rotación incluida vía dimensiones rotadas).
            const aabb = selectionAabb([{ ...o, x: e.target.x(), y: e.target.y() }], [o.id]);
            if (aabb) {
              setLive({ kind: 'move', rect: aabb, others: neighborsRef.current });
              // Guías de alineación del enganche en curso (vacío si no engancha o Alt activo).
              setGuides(
                snapDisabled.current ? null : computeSnap(aabb, neighborsRef.current),
              );
            }
          }}
          onDragEnd={(e) => {
            setLive(null);
            setGuides(null);
            // La posición del nodo ya viene enganchada por dragBoundFunc. Si NO hubo enganche
            // (sin guías), se cae a la rejilla; si hubo enganche, se respeta tal cual para no
            // pelear el magnetismo con el snap de rejilla.
            const aabbEnd = selectionAabb([{ ...o, x: e.target.x(), y: e.target.y() }], [o.id]);
            const snappedNow =
              !snapDisabled.current && aabbEnd
                ? computeSnap(aabbEnd, neighborsRef.current)
                : null;
            const engaged = snappedNow != null && (snappedNow.dx !== 0 || snappedNow.dy !== 0);
            const nx = engaged ? e.target.x() : snap(e.target.x());
            const ny = engaged ? e.target.y() : snap(e.target.y());
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
              // Muros axis-aligned (rotación 0): tras fijar la posición, ESTIRA los extremos
              // para tocar los muros perpendiculares cercanos y cerrar las esquinas (lo que el
              // simple trasladar no logra en ambos extremos). Para muros rotados el AABB no
              // representa su geometría, así que no se aplica. Otros objetos: solo posición.
              // Solo rotación 0: para un muro sin rotar el AABB coincide con {x,y,w,h}, así
              // que el ajuste de x/width (o y/height) se traslada 1:1 al objeto. Con rotación
              // el AABB intercambia ejes y el patch sería incorrecto.
              const isAxisWall = o.kind === 'wall' && o.rotation === 0;
              let patch: Partial<StructObj> = { x: nx, y: ny };
              if (isAxisWall && !snapDisabled.current) {
                const wallAabb = selectionAabb([{ ...o, x: nx, y: ny }], [o.id]);
                const wallCandidates = objects
                  .filter((obj) => obj.id !== o.id && obj.kind === 'wall' && obj.rotation === 0)
                  .map((obj) => selectionAabb([obj], [obj.id]))
                  .filter((r): r is WorldRect => r !== null);
                if (wallAabb) {
                  const stretch = wallStretchToClose(
                    { ...wallAabb, horizontal: wallAabb.width >= wallAabb.height },
                    wallCandidates,
                  );
                  if (stretch) patch = { ...patch, ...stretch };
                }
              }
              updateObject(o.id, patch);
            }
            dragStart.current = null;
            draggingSize.current = null;
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

      {/* Guías de alineación del snap en curso (líneas finas tipo CAD). */}
      <SnapGuidesOverlay guides={guides} />

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
