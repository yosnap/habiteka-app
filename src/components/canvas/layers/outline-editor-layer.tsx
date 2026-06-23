'use client';

/**
 * Capa de EDICIÓN DEL CONTORNO por vértices (modo "Editar contorno"). Dibuja un handle por
 * cada vértice del polígono del suelo (`doc.floorOutline`) y permite arrastrarlos: al soltar,
 * el contorno se actualiza manteniendo la ortogonalidad y los muros se REGENERAN
 * (`setFloorOutline`), de modo que las esquinas siempre cuadran. Doble-clic en un handle quita
 * el vértice; doble-clic en una arista añade uno.
 *
 * Snap al arrastrar: a la rejilla y a las coordenadas X/Y de los OTROS vértices del contorno
 * (alineación de bordes — "detectar la pared a la que está pegado y alinearse"). El arrastre
 * es transitorio (estado local); solo al soltar se escribe en el store (una entrada de
 * historial por edición). Sin `useEffect` directo.
 */
import { useMemo, useState } from 'react';
import { Group, Line, Circle } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '@/canvas/canvas-store';
import type { FloorVertex } from '@/canvas/types';
import { moveVertexOrtho, insertVertexOnEdge, removeVertex } from '@/canvas/wizard/outline-edit';
import { floorPolygonFromWalls } from '@/canvas/3d/floor-from-walls';
import { snap } from './grid-layer';

const HANDLE_R = 7;
const EDGE_HIT = 12; // grosor de la zona clicable de cada arista (px de mundo)
const SNAP_PX = 8; // alinear a la coordenada de otro vértice si está a < esto

/** Ajusta `v` a la coordenada más cercana de `coords` si está dentro del umbral; si no, a rejilla. */
function snapCoord(v: number, coords: number[]): number {
  let best = v;
  let bestDist = SNAP_PX;
  for (const c of coords) {
    const d = Math.abs(c - v);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return bestDist < SNAP_PX ? best : snap(v);
}

export function OutlineEditorLayer() {
  const storedOutline = useCanvasStore((s) => s.doc.floorOutline);
  const objects = useCanvasStore((s) => s.doc.objects);
  const setFloorOutline = useCanvasStore((s) => s.setFloorOutline);
  // El contorno editable: el `floorOutline` del doc (salas del wizard) o, si no existe (sala
  // dibujada/editada a mano), el contorno DERIVADO de los muros actuales — así el editor
  // funciona también en salas hechas a mano. Se memoiza por los muros para no recalcular.
  const outline = useMemo<FloorVertex[] | undefined>(() => {
    if (storedOutline && storedOutline.length >= 3) return storedOutline;
    const walls = objects.filter((o) => o.kind === 'wall');
    const derived = floorPolygonFromWalls(walls);
    return derived && derived.length >= 3 ? derived : undefined;
  }, [storedOutline, objects]);
  // Vértice en arrastre (índice + posición transitoria); null si no se arrastra ninguno.
  const [dragging, setDragging] = useState<{ i: number; x: number; y: number } | null>(null);

  // Polígono efectivo a mostrar (con el vértice en arrastre ya movido ortogonalmente).
  const shown = useMemo<FloorVertex[]>(() => {
    if (!outline) return [];
    if (!dragging) return outline;
    return moveVertexOrtho(outline, dragging.i, dragging.x, dragging.y);
  }, [outline, dragging]);

  if (!outline || outline.length < 3) return null;

  const flatPoints = shown.flatMap((p) => [p.x, p.y]);

  // Coordenadas X/Y de los demás vértices, para alinear el que se arrastra (snap a borde).
  const otherCoords = (i: number) => {
    const xs: number[] = [];
    const ys: number[] = [];
    outline.forEach((p, idx) => {
      if (idx === i) return;
      xs.push(p.x);
      ys.push(p.y);
    });
    return { xs, ys };
  };

  const onDragMove = (i: number) => (e: Konva.KonvaEventObject<DragEvent>) => {
    const { xs, ys } = otherCoords(i);
    const x = snapCoord(e.target.x(), xs);
    const y = snapCoord(e.target.y(), ys);
    e.target.position({ x, y }); // refleja el snap en el handle
    setDragging({ i, x, y });
  };

  const onDragEnd = (i: number) => (e: Konva.KonvaEventObject<DragEvent>) => {
    const { xs, ys } = otherCoords(i);
    const x = snapCoord(e.target.x(), xs);
    const y = snapCoord(e.target.y(), ys);
    setFloorOutline(moveVertexOrtho(outline, i, x, y));
    setDragging(null);
  };

  const onVertexDblClick = (i: number) => () => {
    const next = removeVertex(outline, i);
    if (next) setFloorOutline(next);
  };

  const onEdgeDblClick = (edgeIndex: number) => () => {
    setFloorOutline(insertVertexOnEdge(outline, edgeIndex));
  };

  return (
    <Group>
      {/* Contorno resaltado mientras se edita. */}
      <Line points={flatPoints} closed stroke="#2a8cf0" strokeWidth={1.5} dash={[6, 4]} />

      {/* Aristas clicables (doble-clic añade un vértice en esa arista). */}
      {outline.map((a, i) => {
        const b = outline[(i + 1) % outline.length]!;
        return (
          <Line
            key={`edge-${i}`}
            points={[a.x, a.y, b.x, b.y]}
            stroke="transparent"
            strokeWidth={EDGE_HIT}
            onDblClick={onEdgeDblClick(i)}
            onDblTap={onEdgeDblClick(i)}
          />
        );
      })}

      {/* Handles de los vértices (arrastrables; doble-clic los quita). */}
      {shown.map((p, i) => (
        <Circle
          key={`v-${i}`}
          x={p.x}
          y={p.y}
          radius={HANDLE_R}
          fill="#ffffff"
          stroke="#2a8cf0"
          strokeWidth={2}
          draggable
          onDragMove={onDragMove(i)}
          onDragEnd={onDragEnd(i)}
          onDblClick={onVertexDblClick(i)}
          onDblTap={onVertexDblClick(i)}
        />
      ))}
    </Group>
  );
}
