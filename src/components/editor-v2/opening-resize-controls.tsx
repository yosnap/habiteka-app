'use client';
import { useEffect, useRef } from 'react';
import { Circle, Group } from 'react-konva';
import type Konva from 'konva';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { assertOpeningClearance } from '@/lib/editor-document/opening-clearance';
import { assertEditorDocument } from '@/lib/editor-document/validation';
import { assertSpatialPlacement } from '@/canvas/editor-v2/spatial-placement';
import { wallPath } from '@/lib/editor-document/wall-path';

export function OpeningResizeControls({ store, source, preview, id, scale, onPreview }: {
  store: EditorStore; source: EditorDocument; preview: EditorDocument; id: string; scale: number; onPreview: (doc: EditorDocument | null) => void;
}) {
  const active = useRef<{ node: Konva.Node; doc: EditorDocument | null; error: string | null } | null>(null);
  const group = useRef<Konva.Group>(null);
  useEffect(() => {
    const cancel = () => { const gesture = active.current; active.current = null; gesture?.node.stopDrag(); onPreview(null); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') cancel(); };
    const element = group.current?.getStage()?.container();
    window.addEventListener('keydown', key); element?.addEventListener('pointercancel', cancel);
    const unsubscribe = store.subscribe((s) => { if (active.current && (s.document !== source || s.tool !== 'select' || s.readOnly || s.selection[0] !== id)) cancel(); });
    return () => { window.removeEventListener('keydown', key); element?.removeEventListener('pointercancel', cancel); unsubscribe();
      const gesture = active.current; active.current = null; gesture?.node.stopDrag(); if (gesture) onPreview(null); };
  }, [store, source, id, onPreview]);
  const opening = preview.openings.find((o) => o.id === id);
  if (!opening) return null;
  const host = source.walls.find((w) => w.id === opening.wallId)!, path = wallPath(source, host), length = path.length;
  return <Group ref={group}>{[-1, 1].map((side) => {
    const point = path.at(opening.position + side * opening.widthMm / length / 2);
    return <Circle key={side} x={point.x} y={point.y} radius={6 / scale} fill="white" stroke="#087f75" strokeWidth={2 / scale} draggable
      onDragStart={(e) => { e.cancelBubble = true; active.current = { node: e.target, doc: null, error: null }; }}
      onDragMove={(e) => { e.cancelBubble = true; const gesture = active.current, p = e.target.getStage()?.getRelativePointerPosition(); if (!gesture || !p) return;
        const widthMm = Math.max(50, 2 * Math.abs(path.project(p) - opening.position) * length);
        const candidate = { ...source, openings: source.openings.map((o) => o.id === id ? { ...o, widthMm } : o) };
        let error: string | null = null;
        try { assertEditorDocument(candidate); assertOpeningClearance(candidate, candidate.openings.find((o) => o.id === id)!); assertSpatialPlacement(source, candidate); }
        catch (cause) { error = cause instanceof Error ? cause.message : 'Ancho inválido'; }
        gesture.doc = candidate; gesture.error = error; (e.target as Konva.Circle).stroke(error ? '#ba302f' : '#087f75'); onPreview(candidate);
      }} onDragEnd={(e) => { e.cancelBubble = true; const gesture = active.current; active.current = null; e.target.position(point); (e.target as Konva.Circle).stroke('#087f75'); onPreview(null);
        try { if (gesture?.error) throw new Error(gesture.error); if (gesture?.doc) store.getState().apply(gesture.doc); }
        catch (cause) { store.getState().setError(cause instanceof Error ? cause.message : 'Ancho inválido'); }
      }} />;
  })}</Group>;
}
