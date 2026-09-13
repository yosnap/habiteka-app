'use client';
import { useEffect, useRef, useState } from 'react';
import { Circle, Group, Line, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { Column, EditorDocument, Furniture, Ramp, Stair } from '@/lib/editor-document/schema';
import { localToWorld, objectCenter, transformAroundCenter, upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { assertSpatialPlacement, footprint, snapObject } from '@/canvas/editor-v2/spatial-placement';
import { assertEditorDocument } from '@/lib/editor-document/validation';
import { objectClearances } from '@/canvas/editor-v2/object-clearances';
import { DimensionMark } from './dimension-mark';
import { resizeRampFromCorner } from '@/lib/editor-document/ramp-landing-placement';
import { alignmentGuides } from '@/canvas/editor-v2/alignment-guides';

type ObjectItem = Furniture | Stair | Ramp | Column;
export function ObjectTransformControls({ store, source, id, scale, onPreview }: {
  store: EditorStore; source: EditorDocument; id: string; scale: number; onPreview: (doc: EditorDocument | null) => void;
}) {
  const item = source.furniture.find((f) => f.id === id) ?? source.stairs?.find((s) => s.id === id) ?? source.ramps?.find((r) => r.id === id) ?? source.columns?.find((c) => c.id === id);
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
  const guides = alignmentGuides(source, current);
  const position = `X ${(current.x / 1000).toFixed(3)} · Y ${(current.y / 1000).toFixed(3)} m`;
  const measurement = 'riseMm' in current
    ? `${position} · Ancho ${(current.widthMm / 1000).toFixed(3)} m · Longitud ${(current.depthMm / 1000).toFixed(3)} m · ${current.rotation.toFixed(1)}°`
    : `${position} · ${(current.widthMm / 1000).toFixed(3)} × ${(current.depthMm / 1000).toFixed(3)} m · ${current.rotation.toFixed(1)}°`;
  const center = objectCenter(current), rotate = localToWorld(current, { x: current.widthMm / 2, y: -40 / scale });
  const begin = (node: Konva.Node) => {
    const doc = upgradeSpatialDocument(source), base = doc.furniture.find((f) => f.id === id) ?? doc.stairs!.find((s) => s.id === id) ?? doc.ramps!.find((r) => r.id === id) ?? doc.columns!.find((c) => c.id === id)!;
    gesture.current = { node, doc, item: base, candidate: null, error: null };
  };
  const update = (nextItem: ObjectItem) => {
    const active = gesture.current; if (!active) return;
    const candidate = { ...active.doc, furniture: active.doc.furniture.map((f) => f.id === id ? nextItem as Furniture : f),
      stairs: active.doc.stairs!.map((s) => s.id === id ? nextItem as Stair : s),
      columns: active.doc.columns?.map((c) => c.id === id ? nextItem as Column : c),
      ...(active.doc.ramps ? { ramps: active.doc.ramps.map((r) => r.id === id ? nextItem as Ramp : r) } : {}) };
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
    {guides.map((guide, index) => <AlignmentGuideMark key={`${guide.edge.sourceId}:${index}`} guide={guide} scale={scale} />)}
    {objectClearances(source, current).map((g, i) => <DimensionMark key={i} scale={scale}
      layout={{ ...g, sourceFrom: g.from, sourceTo: g.to }} />)}
    <Line points={[center.x - 140 / scale, center.y, center.x + 140 / scale, center.y]} stroke={color} strokeWidth={1 / scale} dash={[5 / scale, 4 / scale]} listening={false} />
    <Line points={[center.x, center.y - 140 / scale, center.x, center.y + 140 / scale]} stroke={color} strokeWidth={1 / scale} dash={[5 / scale, 4 / scale]} listening={false} />
    <Text x={center.x + 145 / scale} y={center.y - 7 / scale} text="X" fontSize={11 / scale} fill={color} listening={false} />
    <Text x={center.x + 5 / scale} y={center.y - 150 / scale} text="Y" fontSize={11 / scale} fill={color} listening={false} />
    <Line points={footprint(current).flatMap((p) => [p.x, p.y])} closed stroke={color} strokeWidth={2 / scale} listening={false} />
    <Group x={item.x} y={item.y} rotation={item.rotation} draggable
      onDragStart={(e) => { e.cancelBubble = true; begin(e.target); }}
      onDragMove={(e) => { e.cancelBubble = true; const active = gesture.current; if (!active) return;
        const snapped = snapObject(source, { ...active.item, ...e.target.position() }, scale, store.getState().snap);
        // El cursor y el control se detienen en el mismo punto que el plano
        // previsualizado; así el imán se siente como un acople, no como salto al soltar.
        e.target.position({ x: snapped.x, y: snapped.y }); update(snapped);
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
    <Text x={rotate.x + 12 / scale} y={rotate.y - 7 / scale} text="Girar · Mayús: 15°" fontSize={10 / scale} fill={color} listening={false} />
    {footprint(current).map((p, i) => <Circle key={i} x={p.x} y={p.y} radius={6 / scale} fill="white" stroke={color} strokeWidth={2 / scale} draggable
      onDragStart={(e) => { e.cancelBubble = true; begin(e.target); }}
      onDragMove={(e) => { e.cancelBubble = true; const active = gesture.current, pointer = e.target.getStage()?.getRelativePointerPosition(); if (!active || !pointer) return;
        const c = objectCenter(active.item), a = -active.item.rotation * Math.PI / 180, dx = pointer.x - c.x, dy = pointer.y - c.y;
        const resized = 'riseMm' in active.item
          ? resizeRampFromCorner(active.item, i, pointer)
          : transformAroundCenter(active.item, { widthMm: Math.max(50, Math.abs(dx * Math.cos(a) - dy * Math.sin(a)) * 2),
            depthMm: Math.max(50, Math.abs(dx * Math.sin(a) + dy * Math.cos(a)) * 2) });
        update(resized);
      }} onDragEnd={(e) => { e.cancelBubble = true; e.target.position(p); end(); }} />)}
    <Text x={center.x - 160 / scale} y={Math.max(...footprint(current).map((p) => p.y)) + 20 / scale} width={320 / scale} align="center"
      fontSize={12 / scale} fill={color} listening={false} text={shown?.error ?? measurement} />
  </Group>;
}

function AlignmentGuideMark({ guide, scale }: { guide: ReturnType<typeof alignmentGuides>[number]; scale: number }) {
  const snapped = guide.gapMm <= 2, stroke = snapped ? '#00a693' : '#087f75';
  const sx = guide.source.to.x - guide.source.from.x, sy = guide.source.to.y - guide.source.from.y;
  const length = Math.hypot(sx, sy) || 1, ux = sx / length, uy = sy / length;
  const project = (point: { x: number; y: number }) => {
    const dx = guide.edge.to.x - guide.edge.from.x, dy = guide.edge.to.y - guide.edge.from.y, edgeLength = Math.hypot(dx, dy) || 1;
    const along = ((point.x - guide.edge.from.x) * dx + (point.y - guide.edge.from.y) * dy) / edgeLength ** 2;
    return { x: guide.edge.from.x + dx * along, y: guide.edge.from.y + dy * along };
  };
  const a = project(guide.source.from), b = project(guide.source.to), extension = 120 / scale;
  return <Group listening={false}>
    <Line points={[guide.edge.from.x - ux * extension, guide.edge.from.y - uy * extension,
      guide.edge.to.x + ux * extension, guide.edge.to.y + uy * extension]} stroke={stroke} opacity={snapped ? 1 : .65}
      strokeWidth={(snapped ? 3 : 1.5) / scale} dash={snapped ? undefined : [10 / scale, 6 / scale]} />
    <Line points={[guide.source.from.x, guide.source.from.y, guide.source.to.x, guide.source.to.y]} stroke={stroke}
      strokeWidth={(snapped ? 4 : 2) / scale} />
    {!snapped && <><Line points={[guide.source.from.x, guide.source.from.y, a.x, a.y]} stroke={stroke} opacity={.85}
      strokeWidth={1.5 / scale} dash={[6 / scale, 4 / scale]} />
      <Line points={[guide.source.to.x, guide.source.to.y, b.x, b.y]} stroke={stroke} opacity={.85}
        strokeWidth={1.5 / scale} dash={[6 / scale, 4 / scale]} /></>}
  </Group>;
}
