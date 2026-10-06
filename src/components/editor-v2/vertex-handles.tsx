'use client';
import { useEffect, useRef, useState } from 'react';
import { Circle, Group, Line, Text } from 'react-konva';
import type Konva from 'konva';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { EditorDocument, Vertex } from '@/lib/editor-document/schema';
import { previewVertex, previewWallAngles, type VertexDragOptions, type VertexPreview } from '@/canvas/editor-v2/vertex-preview';
import { pointAtLength, typedLengthKey } from '@/canvas/editor-v2/typed-length';
import { modifierKey } from '@/canvas/editor-v2/editor-hints';
import { wallPoints } from '@/lib/editor-document/geometry';
import type { DerivedRoom } from '@/lib/editor-document/rooms';
import { editableOutdoorRoom } from '@/lib/editor-document/outdoor-editing';

export function VertexHandles({ store, source, scale, selected, rooms, preview, onPreview }: {
  store: EditorStore; source: EditorDocument; scale: number; selected: string[]; rooms: DerivedRoom[];
  preview: VertexPreview | null; onPreview: (preview: VertexPreview | null) => void;
}) {
  // `walls`: muros seleccionados que llegan a este extremo (con ⌘ solo se mueven ellos); `pointer`: hacia dónde se lleva.
  const active = useRef<{ node: Konva.Node; vertex: Vertex; base: EditorDocument; candidate: VertexPreview | null;
    walls: string[]; options: VertexDragOptions; pointer: { x: number; y: number } | null } | null>(null);
  const group = useRef<Konva.Group>(null);
  const [typed, setTyped] = useState(''), typedRef = useRef('');
  const setBuffer = (value: string) => { typedRef.current = value; setTyped(value); };
  useEffect(() => {
    const cancel = () => {
      const gesture = active.current; active.current = null; setBuffer('');
      gesture?.node.stopDrag(); if (gesture) gesture.node.position(gesture.vertex);
      onPreview(null);
    };
    // Mientras se arrastra un extremo, las cifras escriben la longitud del muro (Enter la fija), no atajos.
    const key = (e: KeyboardEvent) => {
      const gesture = active.current; if (!gesture) return;
      const result = typedLengthKey(typedRef.current, e.key);
      if (!result.consumed) { if (e.key === 'Escape') cancel(); return; }
      e.preventDefault(); e.stopPropagation(); setBuffer(result.buffer);
      if (!result.commitMm) return;
      const wall = gesture.base.walls.find((w) => gesture.walls.includes(w.id));
      if (!wall || !gesture.pointer) return;
      const [a, b] = wallPoints(gesture.base, wall), fixed = wall.startVertexId === gesture.vertex.id ? b : a;
      const next = previewVertex(gesture.base, gesture.vertex.id, pointAtLength(fixed, gesture.pointer, result.commitMm), scale, false, gesture.options);
      active.current = null; gesture.node.stopDrag(); gesture.node.position(gesture.vertex); onPreview(null);
      try { if (next.error) throw new Error(next.error); store.getState().apply(next.document); }
      catch (error) { store.getState().setError(error instanceof Error ? error.message : 'Edición inválida'); }
    };
    const container = group.current?.getStage()?.container();
    const pointerCancel = () => cancel();
    window.addEventListener('keydown', key, true); container?.addEventListener('pointercancel', pointerCancel);
    const unsubscribe = store.subscribe((state) => {
      if (active.current && (state.document !== active.current.base || state.tool !== 'select' || state.readOnly)) cancel();
    });
    return () => { window.removeEventListener('keydown', key, true); container?.removeEventListener('pointercancel', pointerCancel);
      unsubscribe(); const gesture = active.current; active.current = null;
      gesture?.node.stopDrag(); if (gesture) { gesture.node.position(gesture.vertex); onPreview(null); } };
  }, [store, onPreview, scale]);
  // Un patio seleccionado expone los vértices de sus tramos dibujados (muros ocultos sin tirador propio).
  const outdoorWallIds = new Set(rooms.filter((room) => selected.includes(room.id) && editableOutdoorRoom(source, room))
    .flatMap((room) => room.wallIds.filter((id) => id.startsWith('outdoor:'))));
  const color = preview?.error ? '#ba302f' : '#087f75';
  return <Group ref={group}>
    {preview?.guides.map((g, i) => <Line key={i} points={[g.from.x, g.from.y, g.to.x, g.to.y]}
      stroke={color} strokeWidth={1 / scale} dash={[6 / scale, 4 / scale]} listening={false} />)}
    {preview && <Text x={preview.point.x + 16 / scale} y={preview.point.y - 32 / scale} fontSize={12 / scale}
      fill={color} listening={false} text={typed ? `Medida: ${typed} m · pulsa Enter para aplicarla` : preview.error
        ?? `Suelta para aplicar · Esc: cancelar\nMantén ${modifierKey()} para alargar sin pegarte a esquinas · teclea una medida (p. ej. 3,25) y pulsa Enter`} />}
    {source.vertices.filter((v) => source.walls.some((w) => (selected.includes(w.id) || outdoorWallIds.has(w.id)) &&
      (w.startVertexId === v.id || w.endVertexId === v.id))).map((v) => <Circle key={v.id} x={v.x} y={v.y}
      radius={7 / scale} fill="#fafcfb" stroke={color} strokeWidth={2 / scale} draggable
      onDragStart={(e) => { e.cancelBubble = true; setBuffer('');
        const walls = source.walls.filter((w) => (selected.includes(w.id) || outdoorWallIds.has(w.id)) && (w.startVertexId === v.id || w.endVertexId === v.id)).map((w) => w.id);
        active.current = { node: e.target, vertex: v, base: source, candidate: null, walls, options: {}, pointer: null }; }}
      onDragMove={(e) => {
        e.cancelBubble = true; const gesture = active.current; if (!gesture) return;
        const pointer = e.target.getStage()?.getRelativePointerPosition(); if (!pointer) return;
        // ⌘/Ctrl: el extremo no se une a esquinas ni a muros y solo arrastra los muros seleccionados.
        gesture.options = e.evt.metaKey || e.evt.ctrlKey ? { free: true, detachWalls: gesture.walls } : {};
        gesture.pointer = pointer;
        const next = previewVertex(gesture.base, v.id, pointer, scale, store.getState().snap, gesture.options);
        gesture.candidate = next; e.target.position(next.point); onPreview(next);
      }} onDragEnd={(e) => {
        e.cancelBubble = true; const gesture = active.current; active.current = null; setBuffer(''); e.target.position(v); onPreview(null);
        if (!gesture?.candidate) return;
        try { if (gesture.candidate.error) throw new Error(gesture.candidate.error);
          store.getState().apply(gesture.candidate.document);
        } catch (error) { store.getState().setError(error instanceof Error ? error.message : 'Edición inválida'); }
      }} />)}
    {preview && previewWallAngles(preview, selected).map(({ id, at, degrees, lengthMm }) => <Text key={id} x={at.x} y={at.y + 18 / scale}
      fontSize={12 / scale} text={`${(lengthMm / 1000).toFixed(2).replace('.', ',')} m · ${degrees.toFixed(1)}°`} fill={color} listening={false} />)}
  </Group>;
}
