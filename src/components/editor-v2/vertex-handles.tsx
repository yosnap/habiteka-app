'use client';
import { useEffect, useRef } from 'react';
import { Circle, Group, Line, Text } from 'react-konva';
import type Konva from 'konva';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { EditorDocument, Vertex } from '@/lib/editor-document/schema';
import { previewVertex, type VertexPreview } from '@/canvas/editor-v2/vertex-preview';
import { wallPoints } from '@/lib/editor-document/geometry';

export function VertexHandles({ store, source, scale, selected, preview, onPreview }: {
  store: EditorStore; source: EditorDocument; scale: number; selected: string[];
  preview: VertexPreview | null; onPreview: (preview: VertexPreview | null) => void;
}) {
  const active = useRef<{ node: Konva.Node; vertex: Vertex; base: EditorDocument; candidate: VertexPreview | null } | null>(null);
  const group = useRef<Konva.Group>(null);
  useEffect(() => {
    const cancel = (e?: KeyboardEvent) => {
      if (e && e.key !== 'Escape') return;
      const gesture = active.current; active.current = null;
      gesture?.node.stopDrag(); if (gesture) gesture.node.position(gesture.vertex);
      onPreview(null);
    };
    const container = group.current?.getStage()?.container();
    const pointerCancel = () => cancel();
    window.addEventListener('keydown', cancel); container?.addEventListener('pointercancel', pointerCancel);
    const unsubscribe = store.subscribe((state) => {
      if (active.current && (state.document !== active.current.base || state.tool !== 'select' || state.readOnly)) cancel();
    });
    return () => { window.removeEventListener('keydown', cancel); container?.removeEventListener('pointercancel', pointerCancel);
      unsubscribe(); const gesture = active.current; active.current = null;
      gesture?.node.stopDrag(); if (gesture) { gesture.node.position(gesture.vertex); onPreview(null); } };
  }, [store, onPreview]);
  const color = preview?.error ? '#ba302f' : '#087f75';
  return <Group ref={group}>
    {preview?.guides.map((g, i) => <Line key={i} points={[g.from.x, g.from.y, g.to.x, g.to.y]}
      stroke={color} strokeWidth={1 / scale} dash={[6 / scale, 4 / scale]} listening={false} />)}
    {preview && <Text x={preview.point.x + 16 / scale} y={preview.point.y - 32 / scale} fontSize={12 / scale}
      fill={color} listening={false} text={preview.error ?? 'Vista previa · suelta para confirmar · Esc cancela'} />}
    {source.vertices.filter((v) => source.walls.some((w) => selected.includes(w.id) &&
      (w.startVertexId === v.id || w.endVertexId === v.id))).map((v) => <Circle key={v.id} x={v.x} y={v.y}
      radius={7 / scale} fill="#fafcfb" stroke={color} strokeWidth={2 / scale} draggable
      onDragStart={(e) => { e.cancelBubble = true; active.current = { node: e.target, vertex: v, base: source, candidate: null }; }}
      onDragMove={(e) => {
        e.cancelBubble = true; const gesture = active.current; if (!gesture) return;
        const pointer = e.target.getStage()?.getRelativePointerPosition(); if (!pointer) return;
        const next = previewVertex(gesture.base, v.id, pointer, scale, store.getState().snap);
        gesture.candidate = next; e.target.position(next.point); onPreview(next);
      }} onDragEnd={(e) => {
        e.cancelBubble = true; const gesture = active.current; active.current = null; e.target.position(v); onPreview(null);
        if (!gesture?.candidate) return;
        try { if (gesture.candidate.error) throw new Error(gesture.candidate.error);
          store.getState().apply(gesture.candidate.document);
        } catch (error) { store.getState().setError(error instanceof Error ? error.message : 'Edición inválida'); }
      }} />)}
    {preview && source.walls.filter((w) => selected.includes(w.id)).map((w) => {
      const [a, b] = wallPoints(preview.document, w);
      return <Text key={w.id} x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 + 18 / scale} fontSize={12 / scale}
        text={`${(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI).toFixed(1)}°`} fill={color} listening={false} />;
    })}
  </Group>;
}
