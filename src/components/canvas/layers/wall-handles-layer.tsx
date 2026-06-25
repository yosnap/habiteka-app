'use client';

/**
 * Handles interactivos en los extremos de un muro dibujado manualmente.
 *
 * Aparecen cuando hay exactamente UN muro drawn seleccionado: dos círculos
 * arrastrables (cyan = p1, rosa = p2).
 *
 * Comportamiento durante el arrastre:
 *  - dragBoundFunc aplica snap magnético a extremos de otros muros (imán) y snap
 *    de alineación en X o Y al extremo más próximo (cierre de figura y guías).
 *  - La pared se actualiza en tiempo real en cada frame.
 *  - Los muros vecinos (que ya comparten el extremo arrastrado) también se actualizan.
 *  - Se muestran guías de alineación (líneas azules) y etiquetas de longitud en vivo.
 *  - Al soltar, si no hay snap de extremo activo, se aplica snap al grid.
 */
import { useRef, useState } from 'react';
import { Circle, Group, Label, Line, Tag, Text } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '@/canvas/canvas-store';
import type { StructObj } from '@/canvas/types';
import { segmentToWall } from '@/canvas/draw-wall';
import { formatLength, pxToMeters, isValidScale } from '@/canvas/scale';

const ENDPOINT_SNAP_PX = 18; // imán de cierre (extremo a extremo)
const ALIGN_SNAP_PX    = 12; // imán de alineación X/Y
const ADJ_DIST         = 12; // radio para detectar vecinos ya conectados

// ─── Tipos locales ────────────────────────────────────────────────────────────

type Pt = { x: number; y: number };
type Guide = { type: 'h' | 'v'; coord: number }; // h=horizontal (y fijo), v=vertical (x fijo)
interface AdjWall { wall: StructObj; movedEnd: 'p1' | 'p2'; fixed: Pt }
interface DragLabel { x: number; y: number; text: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Recupera los dos extremos del eje central de un muro dibujado (drawn). */
export function drawnWallEndpoints(
  o: StructObj,
): { p1: Pt; p2: Pt } | null {
  if (!o.drawn) return null;
  const angle = (o.rotation * Math.PI) / 180;
  const nx = Math.sin(angle);
  const ny = -Math.cos(angle);
  const half = o.height / 2;
  const p1 = { x: o.x - nx * half, y: o.y - ny * half };
  const p2 = {
    x: p1.x + Math.cos(angle) * o.width,
    y: p1.y + Math.sin(angle) * o.width,
  };
  return { p1, p2 };
}

function d(a: Pt, b: Pt) { return Math.hypot(a.x - b.x, a.y - b.y); }

// ─── Componente ───────────────────────────────────────────────────────────────

export function WallHandlesLayer({ wall }: { wall: StructObj }) {
  const updateObject = useCanvasStore((s) => s.updateObject);
  const scale        = useCanvasStore((s) => s.doc.scale);
  const allObjects   = useCanvasStore((s) => s.doc.objects);

  // Extremo fijo capturado en dragStart para evitar drift de floating-point.
  const fixedRef   = useRef<Pt | null>(null);
  // Muros vecinos que comparten el extremo arrastrado.
  const adjRef     = useRef<AdjWall[]>([]);
  // Targets de snap: extremos de muros drawn que NO comparten el extremo movido.
  const targetsRef = useRef<Pt[]>([]);
  // Guías calculadas en dragBoundFunc (sync) y leídas en onDragMove para setState.
  const guideBuf   = useRef<Guide[]>([]);
  // ¿El snap de extremo está activo? Para saber si aplicar snap de grid en dragEnd.
  const endSnapRef = useRef(false);

  const [guides, setGuides] = useState<Guide[]>([]);
  const [labels, setLabels] = useState<DragLabel[]>([]);

  const endpoints = drawnWallEndpoints(wall);
  if (!endpoints) return null;
  const { p1, p2 } = endpoints;

  // ── Aplicar nueva geometría al muro ────────────────────────────────────────

  function applyWall(from: Pt, to: Pt) {
    const upd = segmentToWall(wall.id, from, to, scale ?? null);
    if (!upd) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _i, kind: _k, ...patch } = upd;
    updateObject(wall.id, patch);
  }

  function applyAdj(movingPt: Pt) {
    for (const adj of adjRef.current) {
      const [af, at] = adj.movedEnd === 'p1'
        ? [movingPt, adj.fixed]
        : [adj.fixed, movingPt];
      const upd = segmentToWall(adj.wall.id, af, at, scale ?? null);
      if (!upd) continue;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _i, kind: _k, ...patch } = upd;
      updateObject(adj.wall.id, patch);
    }
  }

  function buildLabels(from: Pt, to: Pt): DragLabel[] {
    if (!isValidScale(scale)) return [];
    const result: DragLabel[] = [];
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    result.push({
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2 - 20,
      text: formatLength(pxToMeters(len, scale)),
    });
    for (const adj of adjRef.current) {
      const [af, at] = adj.movedEnd === 'p1'
        ? [from, adj.fixed]
        : [adj.fixed, from];
      const adjLen = Math.hypot(at.x - af.x, at.y - af.y);
      result.push({
        x: (af.x + at.x) / 2,
        y: (af.y + at.y) / 2 - 20,
        text: formatLength(pxToMeters(adjLen, scale)),
      });
    }
    return result;
  }

  // ── dragBoundFunc ──────────────────────────────────────────────────────────
  //
  // Aplica el snap ANTES de que Konva posicione el nodo.  Recibe y devuelve
  // coordenadas ABSOLUTAS (de pantalla).  Usa `this.getLayer()` para convertir
  // entre absoluto y mundo (local del Layer, que coincide con coords del documento).

  function makeDragBound() {
    return function (this: Konva.Node, pos: { x: number; y: number }) {
      const layer = this.getLayer();
      if (!layer) return pos;

      const tf    = layer.getAbsoluteTransform();
      const inv   = tf.copy().invert();
      const world = inv.point(pos);

      guideBuf.current  = [];
      endSnapRef.current = false;

      const targets = targetsRef.current;

      // 1. Snap de extremo (imán de cierre)
      for (const t of targets) {
        if (d(world, t) < ENDPOINT_SNAP_PX) {
          endSnapRef.current = true;
          return tf.point(t);
        }
      }

      // 2. Snap de alineación X/Y (guías)
      let sx = world.x, sy = world.y;
      let bestDx = Infinity, bestDy = Infinity;
      for (const t of targets) {
        const dx = Math.abs(world.x - t.x);
        const dy = Math.abs(world.y - t.y);
        if (dx < ALIGN_SNAP_PX && dx < bestDx) { bestDx = dx; sx = t.x; }
        if (dy < ALIGN_SNAP_PX && dy < bestDy) { bestDy = dy; sy = t.y; }
      }
      if (bestDx < Infinity) guideBuf.current.push({ type: 'v', coord: sx });
      if (bestDy < Infinity) guideBuf.current.push({ type: 'h', coord: sy });

      return tf.point({ x: sx, y: sy });
    };
  }

  // ── Handlers por handle ────────────────────────────────────────────────────

  const makeHandlers = (which: 'p1' | 'p2') => ({
    onDragStart: () => {
      const movingPt = which === 'p1' ? p1 : p2;
      fixedRef.current = which === 'p1' ? p2 : p1;

      // Vecinos ya conectados al extremo que se va a mover
      adjRef.current = [];
      for (const o of allObjects) {
        if (o.id === wall.id || o.kind !== 'wall' || !o.drawn) continue;
        const eps = drawnWallEndpoints(o);
        if (!eps) continue;
        if (d(eps.p1, movingPt) < ADJ_DIST) {
          adjRef.current.push({ wall: o, movedEnd: 'p1', fixed: eps.p2 });
        } else if (d(eps.p2, movingPt) < ADJ_DIST) {
          adjRef.current.push({ wall: o, movedEnd: 'p2', fixed: eps.p1 });
        }
      }

      // Targets de snap: todos los extremos drawn que NO son el extremo movido
      targetsRef.current = [];
      for (const o of allObjects) {
        if (o.kind !== 'wall' || !o.drawn) continue;
        const eps = drawnWallEndpoints(o);
        if (!eps) continue;
        if (d(eps.p1, movingPt) >= ADJ_DIST) targetsRef.current.push(eps.p1);
        if (d(eps.p2, movingPt) >= ADJ_DIST) targetsRef.current.push(eps.p2);
      }
    },

    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
      // dragBoundFunc ya aplicó el snap; e.target.x/y están en coords de mundo.
      const moving: Pt = { x: e.target.x(), y: e.target.y() };
      const fixed = fixedRef.current;
      if (!fixed) return;

      const [from, to] = which === 'p1' ? [moving, fixed] : [fixed, moving];

      applyWall(from, to);
      applyAdj(moving);

      setGuides(guideBuf.current);
      setLabels(buildLabels(from, to));
    },

    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      // La posición final ya viene snappeada por dragBoundFunc (endpoint/alineación).
      // No aplicar snap de grid aquí: causaría un salto visible respecto al último frame.
      const snapped: Pt = { x: e.target.x(), y: e.target.y() };

      const fixed = fixedRef.current ?? (which === 'p1' ? p2 : p1);
      const [from, to] = which === 'p1' ? [snapped, fixed] : [fixed, snapped];

      applyWall(from, to);
      applyAdj(snapped);

      fixedRef.current   = null;
      adjRef.current     = [];
      targetsRef.current = [];
      guideBuf.current   = [];
      endSnapRef.current = false;
      setGuides([]);
      setLabels([]);
    },
  });

  const circleBase = {
    radius: 7,
    stroke: '#ffffff',
    strokeWidth: 2,
    hitStrokeWidth: 12,
    draggable: true,
    dragBoundFunc: makeDragBound(),
    onMouseEnter: (e: Konva.KonvaEventObject<MouseEvent>) => {
      const s = e.target.getStage();
      if (s) s.container().style.cursor = 'crosshair';
    },
    onMouseLeave: (e: Konva.KonvaEventObject<MouseEvent>) => {
      const s = e.target.getStage();
      if (s) s.container().style.cursor = 'default';
    },
    onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => { e.cancelBubble = true; },
  };

  const GUIDE_EXTENT = 20_000;

  return (
    <Group listening>
      {/* Guías de alineación (solo durante el arrastre) */}
      {guides.map((g, i) =>
        g.type === 'h' ? (
          <Line
            key={i}
            points={[-GUIDE_EXTENT, g.coord, GUIDE_EXTENT, g.coord]}
            stroke="#2196f3"
            strokeWidth={1}
            dash={[8, 5]}
            opacity={0.7}
            listening={false}
          />
        ) : (
          <Line
            key={i}
            points={[g.coord, -GUIDE_EXTENT, g.coord, GUIDE_EXTENT]}
            stroke="#2196f3"
            strokeWidth={1}
            dash={[8, 5]}
            opacity={0.7}
            listening={false}
          />
        )
      )}

      {/* Etiquetas de longitud en vivo */}
      {labels.map((lb, i) => (
        <Label key={i} x={lb.x} y={lb.y} listening={false}>
          <Tag fill="#1565c0" cornerRadius={3} opacity={0.9} />
          <Text text={lb.text} fill="#fff" fontSize={11} padding={4} fontStyle="bold" />
        </Label>
      ))}

      {/* Handle p1 (cyan) */}
      <Circle
        {...circleBase}
        x={p1.x}
        y={p1.y}
        fill="#00bcd4"
        {...makeHandlers('p1')}
      />

      {/* Handle p2 (rosa) */}
      <Circle
        {...circleBase}
        x={p2.x}
        y={p2.y}
        fill="#e91e63"
        {...makeHandlers('p2')}
      />
    </Group>
  );
}
