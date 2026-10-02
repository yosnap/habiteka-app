'use client';
import { snapPointDrag } from './magnetic-drag';
import { useMemo } from 'react';
import { useStore } from 'zustand';
import { Circle, Group, Line, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { updateLuminaire } from '@/lib/editor-document/ceiling-commands';
import { ceilingSurfaces, spotAimVector, SPOT_CONE_DEG } from '@/lib/editor-document/ceiling-geometry';
import { activeSceneForRoom, effectiveLuminaire } from '@/lib/editor-document/lighting-scene';
import type { Luminaire } from '@/lib/editor-document/schema';

/**
 * Símbolo direccional del foco orientable: cuña hacia el azimut con longitud
 * proporcional a la inclinación, con la misma dirección que usa el haz en 3D.
 */
function SpotSymbol({ light, enabled, ink, scale }: { light: Luminaire; enabled: boolean; ink: string; scale: number }) {
  const aim = spotAimVector(light);
  const spread = Math.hypot(aim.x, aim.y);
  const angle = Math.atan2(aim.y, aim.x), half = SPOT_CONE_DEG * Math.PI / 360;
  const reach = (7 + 16 * spread) / scale;
  const point = (offset: number) => [Math.cos(angle + offset) * reach, Math.sin(angle + offset) * reach];
  return <>
    <Circle radius={3 / scale} fill={ink} listening={false} />
    {spread > 0.001 && <Line points={[0, 0, ...point(-half), ...point(half)]} closed
      fill={enabled ? 'rgba(248,196,54,.35)' : 'rgba(120,120,120,.2)'} stroke={ink} strokeWidth={1.2 / scale} listening={false} />}
  </>;
}

/** Ceiling outlines never capture pointer events; only light symbols are interactive. */
export function CeilingLightingLayer({ store, scale, disabled }: { store: EditorStore; scale: number; disabled: boolean }) {
  const state = useStore(store), doc = state.document;
  const surfaces = useMemo(() => {
    try { return ceilingSurfaces(doc); } catch { return []; }
  }, [doc]);
  // El encendido que se dibuja es el efectivo: la escena activa de la estancia puede apagar la luz.
  const effective = useMemo(() => new Map((doc.luminaires ?? []).map((light) => [light.id,
    effectiveLuminaire(light, activeSceneForRoom(doc, surfaces.find((item) => item.ceiling.id === light.ceilingId)?.room.id)).enabled])),
    [doc, surfaces]);
  // Mayús, Cmd o Ctrl suman o quitan luces de la selección para editarlas en bloque.
  const pick = (event: KonvaEventObject<MouseEvent | TouchEvent>, id: string) => {
    if (state.tool !== 'select') return;
    event.cancelBubble = true;
    const native = event.evt as MouseEvent;
    const current = store.getState().selection;
    if (!(native.shiftKey || native.metaKey || native.ctrlKey)) { state.select([id]); return; }
    const lights = new Set((doc.luminaires ?? []).map((light) => light.id));
    const kept = current.filter((item) => lights.has(item));
    state.select(kept.includes(id) ? kept.filter((item) => item !== id) : [...kept, id]);
  };
  return <Group listening={!disabled}>
    {/* Zonas de luces guardadas: violeta y con su nombre, para no confundirlas con las zonas permitidas del render. */}
    {(doc.lightZones ?? []).map((zone) => {
      const zoneActive = state.activeLightZoneId === zone.id;
      // El nombre se rotula una sola vez, sobre el punto más alto de toda la zona.
      const vertices = zone.polygonsMm.flat();
      const top = vertices.reduce((best, point) => (point.y < best.y ? point : best), vertices[0]!);
      return <Group key={zone.id} listening={false}>
        {zone.polygonsMm.map((polygon, index) => <Line key={index} points={polygon.flatMap((point) => [point.x, point.y])} closed
          stroke="#7a4fd1" strokeWidth={(zoneActive ? 2.5 : 1.2) / scale} dash={[14 / scale, 8 / scale]}
          fill={zoneActive ? 'rgba(122,79,209,.10)' : undefined} />)}
        <Text x={top.x + 6 / scale} y={top.y - 20 / scale} text={zone.name} fill="#7a4fd1" fontSize={12 / scale} />
      </Group>;
    })}
    {surfaces.filter(({ ceiling }) => state.selection.includes(ceiling.id) || doc.luminaires?.some((light) => light.ceilingId === ceiling.id && state.selection.includes(light.id))).map(({ ceiling, room }) => <Line key={ceiling.id}
      points={room.boundary.flatMap((point) => [point.x, point.y])} closed stroke="#087f75" strokeWidth={1.5 / scale} dash={[6 / scale, 4 / scale]} listening={false} />)}
    {(doc.luminaires ?? []).map((light) => {
      const active = state.selection.includes(light.id), ink = active ? '#087f75' : '#75521d';
      const enabled = effective.get(light.id) ?? light.enabled;
      return <Group key={light.id} x={light.x} y={light.y} draggable={!state.readOnly && state.tool === 'select'}
        onClick={(e) => pick(e, light.id)}
        onTap={(e) => pick(e, light.id)}
        onDragStart={() => { if (!store.getState().selection.includes(light.id)) state.select([light.id]); }}
        onDragMove={(e) => e.target.position(snapPointDrag(store, e.target.position(), scale, [light.id]))}
        onDragEnd={(e) => {
          const point = e.target.position(); e.target.position({ x: light.x, y: light.y });
          try { const current = store.getState(); current.apply(updateLuminaire(current.document, light.id, point)); }
          catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo mover la luminaria'); }
        }}>
        <Circle radius={9 / scale} fill={enabled ? '#fff3c4' : '#eef1ef'} stroke={ink} strokeWidth={(active ? 2.5 : 1.5) / scale} hitStrokeWidth={26 / scale} />
        {light.kind === 'spot' ? <SpotSymbol light={light} enabled={enabled} ink={ink} scale={scale} />
          : light.kind === 'flush' ? <Circle radius={4 / scale} stroke={ink} strokeWidth={1 / scale} listening={false} />
          : <><Line points={[-4 / scale, 0, 4 / scale, 0]} stroke={ink} strokeWidth={1.5 / scale} listening={false} />
          <Line points={[0, -4 / scale, 0, 4 / scale]} stroke={ink} strokeWidth={1.5 / scale} listening={false} /></>}
        {light.kind === 'pendant' && <Circle y={-12 / scale} radius={2 / scale} fill={ink} listening={false} />}
      </Group>;
    })}
  </Group>;
}
