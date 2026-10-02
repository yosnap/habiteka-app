'use client';
import { useMemo } from 'react';
import { snapPointDrag } from './magnetic-drag';
import { useStore } from 'zustand';
import { Circle, Group, Line, Text } from 'react-konva';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { putWalkthrough } from '@/lib/editor-document/walkthrough';
import { buildWalkthrough } from '@/lib/editor-document/walkthrough-geometry';
import { CAMERA_CLEARANCE_MM } from '@/lib/editor-document/walkthrough-navigation';
import { planObjects } from '@/lib/editor-document/boundary-types';
import { localToWorld } from '@/lib/editor-document/spatial-properties';

export function WalkthroughLayer({ store, scale, disabled }: { store: EditorStore; scale: number; disabled: boolean }) {
  const state = useStore(store), route = state.document.walkthroughs?.find((path) => path.id === state.walkthroughId);
  const blocks = useMemo(() => {
    if (!route || route.waypoints.length < 2) return [];
    try { return buildWalkthrough(state.document, route).blockedSegments; }
    catch { return []; }
  }, [state.document, route]);
  if (!route) return null;
  const multiLevel = route.waypoints.some((point) => point.levelId);
  const segments = Array.from({ length: route.loop ? route.waypoints.length : Math.max(0, route.waypoints.length - 1) }, (_, index) => ({
    index, from: route.waypoints[index]!, to: route.waypoints[(index + 1) % route.waypoints.length]!,
    block: blocks.find((item) => item.index === index)?.block,
  })).filter(({ from, to }) => !multiLevel || (from.levelId === state.document.activeLevelId && to.levelId === from.levelId));
  const focused = segments.find((segment) => segment.index === state.walkthroughFocusIndex && segment.block);
  const obstacle = focused?.block?.kind === 'furniture' ? planObjects(state.document).find((item) => item.id === focused.block?.entityId) : null;
  const margin = CAMERA_CLEARANCE_MM;
  const obstacleOutline = obstacle && [
    { x: -margin, y: -margin }, { x: obstacle.widthMm + margin, y: -margin },
    { x: obstacle.widthMm + margin, y: obstacle.depthMm + margin }, { x: -margin, y: obstacle.depthMm + margin },
  ].map((point) => localToWorld(obstacle, point));
  return <Group>
    {obstacleOutline && <Line points={obstacleOutline.flatMap((point) => [point.x, point.y])} closed
      stroke="#b42318" fill="rgba(180,35,24,0.14)" strokeWidth={3 / scale} dash={[7 / scale, 4 / scale]} listening={false} />}
    {segments.map(({ index, from, to, block }) => <Line key={`${from.id}:${to.id}`}
      points={[from.x, from.y, to.x, to.y]} stroke={block ? '#b42318' : '#186cca'}
      strokeWidth={(index === state.walkthroughFocusIndex ? 5 : block ? 4 : 3) / scale}
      dash={block ? undefined : [8 / scale, 4 / scale]} listening={false} />)}
    {segments.filter((segment) => segment.block).map(({ index, block }) => <Group key={`block:${index}`}
      x={block!.point.x} y={block!.point.y} listening={false}>
      <Circle radius={(index === state.walkthroughFocusIndex ? 13 : 9) / scale} fill="#fff" stroke="#b42318" strokeWidth={3 / scale} />
      <Text x={-6 / scale} y={-8 / scale} width={12 / scale} align="center" text="!" fontStyle="bold"
        fontSize={15 / scale} fill="#b42318" />
    </Group>)}
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
