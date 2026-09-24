'use client';
import { useMemo } from 'react';
import { useStore } from 'zustand';
import { Circle, Group, Line, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { snapPointDrag } from './magnetic-drag';
import { setLightStripPath } from '@/lib/editor-document/light-strip-commands';
import { resolvedStrips } from '@/lib/editor-document/light-strip-geometry';

/**
 * Tiras LED en el plano. El foseado derivado se dibuja discontinuo (sigue al
 * muro) y cualquier tira ajustada a mano, continua: así se ve de un vistazo
 * cuál dejó de seguir al contorno. Arrastrar un vértice desliga la tira.
 */
export function LightStripLayer({ store, scale, disabled }: { store: EditorStore; scale: number; disabled: boolean }) {
  const state = useStore(store), doc = state.document;
  const strips = useMemo(() => {
    try { return resolvedStrips(doc); } catch { return []; }
  }, [doc]);
  // Mayús, Cmd o Ctrl suman o quitan tiras de la selección, igual que las luces.
  const pick = (event: KonvaEventObject<MouseEvent | TouchEvent>, id: string) => {
    if (state.tool !== 'select') return;
    event.cancelBubble = true;
    const native = event.evt as MouseEvent;
    if (!(native.shiftKey || native.metaKey || native.ctrlKey)) { state.select([id]); return; }
    const known = new Set((doc.lightStrips ?? []).map((strip) => strip.id));
    const kept = store.getState().selection.filter((item) => known.has(item));
    state.select(kept.includes(id) ? kept.filter((item) => item !== id) : [...kept, id]);
  };
  const moveVertex = (id: string, path: readonly { x: number; y: number }[], index: number, point: { x: number; y: number }) => {
    const next = path.map((vertex, i) => (i === index ? point : vertex));
    // Un anillo de foseado mantiene su cierre: el primer y el último punto van juntos.
    const first = path[0]!, last = path[path.length - 1]!;
    if (Math.hypot(first.x - last.x, first.y - last.y) < 1) {
      if (index === 0) next[next.length - 1] = point;
      if (index === path.length - 1) next[0] = point;
    }
    try { const current = store.getState(); current.apply(setLightStripPath(current.document, id, next)); }
    catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo mover la tira LED'); }
  };
  return <Group listening={!disabled}>
    {strips.map(({ strip, pathMm, lengthMm, effectiveEnabled }) => {
      const active = state.selection.includes(strip.id);
      // El encendido que se ve es el efectivo: la escena activa puede apagar la tira.
      const ink = active ? '#087f75' : effectiveEnabled ? '#c78a18' : '#8d8d8d';
      const middle = pathMm[Math.floor(pathMm.length / 2)]!;
      return <Group key={strip.id}>
        <Line points={pathMm.flatMap((point) => [point.x, point.y])}
          stroke={ink} strokeWidth={(strip.kind === 'free' ? 4 : 2.5) / scale}
          dash={strip.derived ? [10 / scale, 6 / scale] : undefined}
          hitStrokeWidth={20 / scale} lineCap="round" lineJoin="round"
          onClick={(event) => pick(event, strip.id)} onTap={(event) => pick(event, strip.id)} />
        {(active || strip.kind === 'free') && <Text x={middle.x + 8 / scale} y={middle.y - 18 / scale}
          text={`${(lengthMm / 1000).toFixed(2)} m${strip.derived ? '' : ' · a mano'}`}
          fill={ink} fontSize={12 / scale} listening={false} />}
        {active && !state.readOnly && state.tool === 'select' && pathMm.map((point, index) => <Circle key={index}
          x={point.x} y={point.y} radius={6 / scale} fill="#ffffff" stroke={ink} strokeWidth={2 / scale}
          hitStrokeWidth={18 / scale} draggable
          onDragMove={(event) => event.target.position(snapPointDrag(store, event.target.position(), scale, [strip.id]))}
          onDragEnd={(event) => {
            const next = event.target.position();
            event.target.position({ x: point.x, y: point.y });
            moveVertex(strip.id, pathMm, index, next);
          }} />)}
      </Group>;
    })}
  </Group>;
}
