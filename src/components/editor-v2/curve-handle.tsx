'use client';
import { useEffect, useRef } from 'react';
import { Circle, Line } from 'react-konva';
import type Konva from 'konva';
import type { EditorDocument, Wall } from '@/lib/editor-document/schema';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { wallPath } from '@/lib/editor-document/wall-path';
import { setWallCurve } from '@/lib/editor-document/curve-commands';
import { wallPoints } from '@/lib/editor-document/geometry';

export function CurveHandle({ doc, wall, store, scale, onPreview }: {
  doc: EditorDocument; wall: Wall; store: EditorStore; scale: number; onPreview: (doc: EditorDocument | null) => void;
}) {
  const ref = useRef<Konva.Circle>(null), dragging = useRef(false);
  const p = wallPath(doc, wall).at(.5), [a, b] = wallPoints(doc, wall), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const candidate = (node: Konva.Circle) => {
    const source = store.getState().document, original = source.walls.find((w) => w.id === wall.id)!;
    const [start, end] = wallPoints(source, original), length = Math.hypot(end.x - start.x, end.y - start.y);
    const height = ((node.x() - (start.x + end.x) / 2) * -(end.y - start.y) + (node.y() - (start.y + end.y) / 2) * (end.x - start.x)) / length;
    return setWallCurve(source, wall.id, Math.max(-length / 2, Math.min(length / 2, height)));
  };
  useEffect(() => {
    const cancel = (e: KeyboardEvent) => { if (e.key === 'Escape') { dragging.current = false; ref.current?.stopDrag(); onPreview(null); } };
    window.addEventListener('keydown', cancel); return () => window.removeEventListener('keydown', cancel);
  }, [onPreview]);
  return <>
    <Line points={[mid.x, mid.y, p.x, p.y]} dash={[4 / scale, 4 / scale]} stroke="#087f75" strokeWidth={1 / scale} listening={false} />
    <Circle ref={ref} x={p.x} y={p.y} radius={7 / scale} fill="#fff" stroke="#087f75" strokeWidth={2 / scale} draggable
      onDragStart={() => { dragging.current = true; }} onDragMove={(e) => {
        try { onPreview(candidate(e.target as Konva.Circle)); } catch { /* Keep the last valid geometric preview. */ }
      }} onDragEnd={(e) => {
        if (!dragging.current) return; dragging.current = false;
        try { store.getState().apply(candidate(e.target as Konva.Circle)); }
        catch (error) { store.getState().setError(error instanceof Error ? error.message : 'Curvatura inválida'); }
        onPreview(null);
      }} />
  </>;
}
