'use client';
import { snapPointDrag } from './magnetic-drag';
import { useStore } from 'zustand';
import { Circle, Group, Line, Text } from 'react-konva';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { putWalkthrough } from '@/lib/editor-document/walkthrough';

export function WalkthroughLayer({ store, scale, disabled }: { store: EditorStore; scale: number; disabled: boolean }) {
  const state = useStore(store), route = state.document.walkthroughs?.find((path) => path.id === state.walkthroughId);
  if (!route) return null;
  const multiLevel = route.waypoints.some((point) => point.levelId);
  const points = route.loop ? [...route.waypoints, route.waypoints[0]].filter((p) => !!p) : route.waypoints;
  return <Group>
    {multiLevel ? points.slice(1).map((point, index) => point.levelId === state.document.activeLevelId &&
      points[index]!.levelId === point.levelId && <Line key={`${points[index]!.id}:${point.id}`}
        points={[points[index]!.x, points[index]!.y, point.x, point.y]} stroke="#186cca"
        strokeWidth={3 / scale} dash={[8 / scale, 4 / scale]} listening={false} />)
      : <Line points={points.flatMap((p) => [p.x, p.y])} stroke="#186cca" strokeWidth={3 / scale} dash={[8 / scale, 4 / scale]} listening={false} />}
    {route.waypoints.map((p, index) => (!multiLevel || p.levelId === state.document.activeLevelId) && <Group key={p.id} x={p.x} y={p.y} draggable={!disabled && !state.readOnly}
      onClick={(e) => { e.cancelBubble = true; state.select([p.id]); }} onTap={(e) => { e.cancelBubble = true; state.select([p.id]); }}
      onPointerDown={(e) => { e.cancelBubble = true; }} onDragMove={(e) => e.target.position(snapPointDrag(store, e.target.position(), scale, [p.id]))} onDragEnd={(e) => {
        const xy = e.target.position(); e.target.position(p);
        try { state.apply(putWalkthrough(state.document, { ...route, waypoints: route.waypoints.map((w) => w.id === p.id ? { ...w, ...xy } : w) })); }
        catch (error) { state.setError(error instanceof Error ? error.message : 'Punto inválido'); }
      }}>
      <Circle radius={12 / scale} fill="#186cca" stroke="white" strokeWidth={2 / scale} />
      <Text x={-12 / scale} y={-6 / scale} width={24 / scale} align="center" text={String(index + 1)} fontSize={12 / scale} fill="white" listening={false} />
    </Group>)}
  </Group>;
}
