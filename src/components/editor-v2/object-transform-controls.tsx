'use client';
import { useEffect, useRef, useState } from 'react';
import { Circle, Group, Line, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { EditorDocument, Furniture, Stair } from '@/lib/editor-document/schema';
import { localToWorld, objectCenter, transformAroundCenter, upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { assertSpatialPlacement, footprint, snapObject } from '@/canvas/editor-v2/spatial-placement';
import { assertEditorDocument } from '@/lib/editor-document/validation';
import { objectClearances } from '@/canvas/editor-v2/object-clearances';
import { DimensionMark } from './dimension-mark';

type ObjectItem = Furniture | Stair;
export function ObjectTransformControls({ store, source, id, scale, onPreview }: {
  store: EditorStore; source: EditorDocument; id: string; scale: number; onPreview: (doc: EditorDocument | null) => void;
}) {
  const item = source.furniture.find((f) => f.id === id) ?? source.stairs?.find((s) => s.id === id);
  const group = useRef<Konva.Group>(null);
  const gesture = useRef<{ node: Konva.Node; doc: EditorDocument; item: ObjectItem; candidate: EditorDocument | null; error: string | null } | null>(null);
  const [shown, setShown] = useState<{ item: ObjectItem; error: string | null } | null>(null);
  useEffect(() => {
    const cancel = () => { const active = gesture.current; gesture.current = null; active?.node.stopDrag();
      setShown(null); onPreview(null); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') cancel(); };
    const element = group.current?.getStage()?.container();
    window.addEventListener('keydown', key); element?.addEventListener('pointercancel', cancel);
    const unsubscribe = store.subscribe((s) => {
      if (gesture.current && (s.document !== source || s.tool !== 'select' || s.readOnly || s.selection[0] !== id)) cancel();
    });
    return () => { window.removeEventListener('keydown', key); element?.removeEventListener('pointercancel', cancel); unsubscribe();
      const active = gesture.current; gesture.current = null; active?.node.stopDrag(); if (active) onPreview(null); };
  }, [store, source, id, onPreview]);
  if (!item) return null;
  const current = shown?.item ?? item, color = shown?.error ? '#ba302f' : '#087f75';
  const center = objectCenter(current), rotate = localToWorld(current, { x: current.widthMm / 2, y: -40 / scale });
  const begin = (node: Konva.Node) => {
    const doc = upgradeSpatialDocument(source), base = doc.furniture.find((f) => f.id === id) ?? doc.stairs!.find((s) => s.id === id)!;
    gesture.current = { node, doc, item: base, candidate: null, error: null };
  };
  const update = (nextItem: ObjectItem) => {
    const active = gesture.current; if (!active) return;
    const candidate = { ...active.doc, furniture: active.doc.furniture.map((f) => f.id === id ? nextItem as Furniture : f),
      stairs: active.doc.stairs!.map((s) => s.id === id ? nextItem as Stair : s) };
    let error: string | null = null;
    try { assertEditorDocument(candidate); assertSpatialPlacement(source, candidate); }
    catch (cause) { error = cause instanceof Error ? cause.message : 'Transformación inválida'; }
    active.candidate = candidate; active.error = error; setShown({ item: nextItem, error }); onPreview(candidate);
  };
  const end = () => {
    const active = gesture.current; gesture.current = null; setShown(null); onPreview(null);
    if (!active?.candidate) return;
    try { if (active.error) throw new Error(active.error); store.getState().apply(active.candidate); }
    catch (cause) { store.getState().setError(cause instanceof Error ? cause.message : 'Edición inválida'); }
  };
  return <Group ref={group}>
    {objectClearances(source, current).map((g, i) => <DimensionMark key={i} scale={scale}
      layout={{ ...g, sourceFrom: g.from, sourceTo: g.to }} />)}
    <Line points={footprint(current).flatMap((p) => [p.x, p.y])} closed stroke={color} strokeWidth={2 / scale} listening={false} />
    <Group x={item.x} y={item.y} rotation={item.rotation} draggable
      onDragStart={(e) => { e.cancelBubble = true; begin(e.target); }}
      onDragMove={(e) => { e.cancelBubble = true; const active = gesture.current; if (!active) return;
        update(snapObject(source, { ...active.item, ...e.target.position() }, scale, store.getState().snap));
      }} onDragEnd={(e) => { e.cancelBubble = true; e.target.position(item); end(); }}>
      <Rect width={item.widthMm} height={item.depthMm} fill="rgba(0,0,0,0.001)" />
    </Group>
    <Line points={[center.x, center.y, rotate.x, rotate.y]} stroke={color} strokeWidth={1 / scale} dash={[4 / scale, 4 / scale]} listening={false} />
    <Circle x={rotate.x} y={rotate.y} radius={9 / scale} fill="white" stroke={color} strokeWidth={2 / scale} draggable
      onDragStart={(e) => { e.cancelBubble = true; begin(e.target); }}
      onDragMove={(e) => { e.cancelBubble = true; const active = gesture.current, p = e.target.getStage()?.getRelativePointerPosition(); if (!active || !p) return;
        const c = objectCenter(active.item); let rotation = Math.atan2(p.y - c.y, p.x - c.x) * 180 / Math.PI + 90;
        if (e.evt.shiftKey) rotation = Math.round(rotation / 15) * 15;
        update(transformAroundCenter(active.item, { rotation }));
      }} onDragEnd={(e) => { e.cancelBubble = true; e.target.position(rotate); end(); }} />
    {footprint(current).map((p, i) => <Circle key={i} x={p.x} y={p.y} radius={6 / scale} fill="white" stroke={color} strokeWidth={2 / scale} draggable
      onDragStart={(e) => { e.cancelBubble = true; begin(e.target); }}
      onDragMove={(e) => { e.cancelBubble = true; const active = gesture.current, pointer = e.target.getStage()?.getRelativePointerPosition(); if (!active || !pointer) return;
        const c = objectCenter(active.item), a = -active.item.rotation * Math.PI / 180, dx = pointer.x - c.x, dy = pointer.y - c.y;
        update(transformAroundCenter(active.item, { widthMm: Math.max(50, Math.abs(dx * Math.cos(a) - dy * Math.sin(a)) * 2),
          depthMm: Math.max(50, Math.abs(dx * Math.sin(a) + dy * Math.cos(a)) * 2) }));
      }} onDragEnd={(e) => { e.cancelBubble = true; e.target.position(p); end(); }} />)}
    <Text x={center.x - 160 / scale} y={Math.max(...footprint(current).map((p) => p.y)) + 20 / scale} width={320 / scale} align="center"
      fontSize={12 / scale} fill={color} listening={false} text={shown?.error ?? `${(current.widthMm / 10).toFixed(1)} × ${(current.depthMm / 10).toFixed(1)} cm · ${current.rotation.toFixed(1)}°`} />
  </Group>;
}
