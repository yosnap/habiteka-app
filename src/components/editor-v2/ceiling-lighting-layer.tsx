'use client';
import { snapPointDrag } from './magnetic-drag';
import { useMemo } from 'react';
import { useStore } from 'zustand';
import { Circle, Group, Line } from 'react-konva';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { updateLuminaire } from '@/lib/editor-document/ceiling-commands';
import { ceilingSurfaces } from '@/lib/editor-document/ceiling-geometry';

/** Ceiling outlines never capture pointer events; only light symbols are interactive. */
export function CeilingLightingLayer({ store, scale, disabled }: { store: EditorStore; scale: number; disabled: boolean }) {
  const state = useStore(store), doc = state.document;
  const surfaces = useMemo(() => {
    try { return ceilingSurfaces(doc); } catch { return []; }
  }, [doc]);
  return <Group listening={!disabled}>
    {surfaces.filter(({ ceiling }) => state.selection.includes(ceiling.id) || doc.luminaires?.some((light) => light.ceilingId === ceiling.id && state.selection.includes(light.id))).map(({ ceiling, room }) => <Line key={ceiling.id}
      points={room.boundary.flatMap((point) => [point.x, point.y])} closed stroke="#087f75" strokeWidth={1.5 / scale} dash={[6 / scale, 4 / scale]} listening={false} />)}
    {(doc.luminaires ?? []).map((light) => {
      const active = state.selection.includes(light.id), ink = active ? '#087f75' : '#75521d';
      return <Group key={light.id} x={light.x} y={light.y} draggable={!state.readOnly && state.tool === 'select'}
        onClick={(e) => { if (state.tool === 'select') { e.cancelBubble = true; state.select([light.id]); } }}
        onTap={(e) => { if (state.tool === 'select') { e.cancelBubble = true; state.select([light.id]); } }}
        onDragStart={() => state.select([light.id])}
        onDragMove={(e) => e.target.position(snapPointDrag(store, e.target.position(), scale, [light.id]))}
        onDragEnd={(e) => {
          const point = e.target.position(); e.target.position({ x: light.x, y: light.y });
          try { const current = store.getState(); current.apply(updateLuminaire(current.document, light.id, point)); }
          catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo mover la luminaria'); }
        }}>
        <Circle radius={9 / scale} fill={light.enabled ? '#fff3c4' : '#eef1ef'} stroke={ink} strokeWidth={(active ? 2.5 : 1.5) / scale} hitStrokeWidth={26 / scale} />
        {light.kind === 'flush' ? <Circle radius={4 / scale} stroke={ink} strokeWidth={1 / scale} listening={false} />
          : <><Line points={[-4 / scale, 0, 4 / scale, 0]} stroke={ink} strokeWidth={1.5 / scale} listening={false} />
          <Line points={[0, -4 / scale, 0, 4 / scale]} stroke={ink} strokeWidth={1.5 / scale} listening={false} /></>}
        {light.kind === 'pendant' && <Circle y={-12 / scale} radius={2 / scale} fill={ink} listening={false} />}
      </Group>;
    })}
  </Group>;
}
