'use client';
import { duplicatePlanElement } from '@/canvas/editor-v2/duplicate-plan-element';
import { useEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import { Circle, Group, Line, Rect, Text } from 'react-konva';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { EditorDocument, TerrainSurface } from '@/lib/editor-document/schema';
import { updateTerrainSurface } from '@/lib/editor-document/terrain-surfaces';
import { snapTerrainMove, snapTerrainResize, TERRAIN_HANDLES } from '@/canvas/editor-v2/terrain-transform';

export function TerrainTransformControls({ store, source, surface, scale, onPreview }: {
  store: EditorStore; source: EditorDocument; surface: TerrainSurface; scale: number;
  onPreview: (doc: EditorDocument | null) => void;
}) {
  const group = useRef<Konva.Group>(null);
  const gesture = useRef<{ node: Konva.Node; candidate: EditorDocument | null; duplicate?: boolean; copyId?: string } | null>(null);
  const [shown, setShown] = useState<TerrainSurface | null>(null);
  useEffect(() => {
    const cancel = () => {
      const active = gesture.current; gesture.current = null; active?.node.stopDrag();
      setShown(null); onPreview(null); store.getState().setMagneticGuides([]);
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && gesture.current) cancel(); };
    const container = group.current?.getStage()?.container();
    window.addEventListener('keydown', key); container?.addEventListener('pointercancel', cancel);
    const unsubscribe = store.subscribe(state => {
      if (gesture.current && (state.document !== source || state.tool !== 'select' || state.readOnly || state.pan || state.selection.length !== 1 || state.selection[0] !== surface.id)) cancel();
    });
    return () => {
      window.removeEventListener('keydown', key); container?.removeEventListener('pointercancel', cancel); unsubscribe();
      const active = gesture.current; gesture.current = null; active?.node.stopDrag();
      if (active) { onPreview(null); store.getState().setMagneticGuides([]); }
    };
  }, [store, source, surface.id, onPreview]);
  const current = shown ?? surface, unit = 1 / Math.max(.001, scale);
  const center = { x: surface.x + surface.widthMm / 2, y: surface.y + surface.depthMm / 2 };
  const begin = (node: Konva.Node, duplicate = false) => { gesture.current = { node, candidate: null, duplicate }; };
  const update = (next: TerrainSurface) => {
    if (!gesture.current) return;
    if (gesture.current.duplicate) {
      const copy = duplicatePlanElement(source, surface.id, { x: next.x - surface.x, y: next.y - surface.y });
      gesture.current.candidate = copy.document; gesture.current.copyId = copy.id;
      setShown(next); onPreview(copy.document); return;
    }
    const candidate = updateTerrainSurface(source, surface.id, { x: next.x, y: next.y, widthMm: next.widthMm, depthMm: next.depthMm });
    gesture.current.candidate = candidate; setShown(next); onPreview(candidate);
  };
  const end = () => {
    const active = gesture.current; gesture.current = null; setShown(null); onPreview(null); store.getState().setMagneticGuides([]);
    if (!active?.candidate) return;
    try { store.getState().apply(active.candidate); if (active.copyId) store.getState().select([active.copyId]); }
    catch (error) { store.getState().setError(error instanceof Error ? error.message : 'No se pudo ajustar la superficie.'); }
  };
  const color = '#087f75';
  return <Group ref={group}>
    <Rect x={current.x} y={current.y} width={current.widthMm} height={current.depthMm} stroke={color} strokeWidth={2 * unit} listening={false} />
    {TERRAIN_HANDLES.map(([hx, hy], index) => <Rect key={index}
      x={current.x + current.widthMm * hx} y={current.y + current.depthMm * hy}
      width={12 * unit} height={12 * unit} offsetX={6 * unit} offsetY={6 * unit} hitStrokeWidth={12 * unit}
      fill="white" stroke={color} strokeWidth={2 * unit} cornerRadius={2 * unit} draggable
      onMouseEnter={event => { const container = event.target.getStage()?.container(); if (container) container.style.cursor = hx === .5 ? 'ns-resize' : hy === .5 ? 'ew-resize' : hx === hy ? 'nwse-resize' : 'nesw-resize'; }}
      onMouseLeave={event => { const container = event.target.getStage()?.container(); if (container) container.style.cursor = 'default'; }}
      onDragStart={event => { event.cancelBubble = true; begin(event.target); }}
      onDragMove={event => {
        event.cancelBubble = true; const pointer = event.target.getStage()?.getRelativePointerPosition(); if (!pointer || !gesture.current) return;
        const result = snapTerrainResize(source, surface, index, pointer, scale, store.getState().snap);
        store.getState().setMagneticGuides(result.guides); update(result.surface);
      }}
      onDragEnd={event => { event.cancelBubble = true; end(); }} />)}
    <Group x={center.x} y={center.y} draggable
      onMouseEnter={event => { const container = event.target.getStage()?.container(); if (container) container.style.cursor = 'move'; }}
      onMouseLeave={event => { const container = event.target.getStage()?.container(); if (container) container.style.cursor = 'default'; }}
      onDragStart={event => { event.cancelBubble = true; begin(event.target, event.evt.altKey); }}
      onDragMove={event => {
        event.cancelBubble = true; if (!gesture.current) return;
        const result = snapTerrainMove(source, surface, { x: event.target.x() - center.x, y: event.target.y() - center.y }, scale, store.getState().snap);
        event.target.position({ x: center.x + result.delta.x, y: center.y + result.delta.y });
        store.getState().setMagneticGuides(result.guides); update({ ...surface, x: surface.x + result.delta.x, y: surface.y + result.delta.y });
      }} onDragEnd={event => { event.cancelBubble = true; event.target.position(center); end(); }}>
      <Circle radius={14 * unit} fill="white" stroke={color} strokeWidth={2 * unit} />
      <Line points={[-7 * unit, 0, 7 * unit, 0]} stroke={color} strokeWidth={2 * unit} listening={false} />
      <Line points={[0, -7 * unit, 0, 7 * unit]} stroke={color} strokeWidth={2 * unit} listening={false} />
    </Group>
    <Text x={current.x} y={current.y + current.depthMm + 15 * unit} width={Math.max(current.widthMm, 220 * unit)}
      text={`${(current.widthMm / 1000).toFixed(2)} × ${(current.depthMm / 1000).toFixed(2)} m · bordes para ajustar, centro para mover`}
      fontSize={12 * unit} fill={color} listening={false} />
  </Group>;
}
