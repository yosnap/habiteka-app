'use client';
import { snapSpatialDrag } from './magnetic-drag';
import { clickSelect } from '@/canvas/editor-v2/selection-click';

import { useEffect, useMemo, useRef } from 'react';
import { useStore } from 'zustand';
import { Arrow, Group, Line, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { moveEntity } from '@/canvas/editor-v2/editing-operations';
import { snapObject } from '@/canvas/editor-v2/spatial-placement';
import { stairLayout } from '@/lib/editor-document/stair-layout';
import type { EditorDocument, Stair } from '@/lib/editor-document/schema';
import { walkableSurfaceFinish } from '@/lib/editor-document/floor-finishes';
import { FloorSurface } from './floor-surface';

interface StairLayerProps {
  store: EditorStore;
  scale: number;
  /** Pan mode must not start element drags or intercept stage selection. */
  disabled?: boolean;
  documentPreview?: EditorDocument;
}

const INK = '#52615c';
const ACCENT = '#087f75';

export function StairLayer({ store, scale, disabled = false, documentPreview }: StairLayerProps) {
  const container = useRef<Konva.Group>(null);
  const dragging = useRef<{ node: Konva.Node; stair: Stair } | null>(null);
  const source = useStore(store, (state) => state.document.stairs);
  const stairs = documentPreview?.stairs ?? source;
  const selection = useStore(store, (state) => state.selection);
  const tool = useStore(store, (state) => state.tool);
  const readOnly = useStore(store, (state) => state.readOnly);
  const models = useMemo(() => (stairs ?? []).map((stair) => {
    const layout = stairLayout(stair);
    const ordered = [...layout.steps, ...layout.landings].sort((a, b) => a.heightMm - b.heightMm);
    return { stair, layout, ascent: ordered.flatMap((step) =>
      [step.x + step.widthMm / 2, step.y + step.depthMm / 2]) };
  }), [stairs]);
  const unit = 1 / Math.max(scale, 0.0001);
  const selectable = !disabled && tool === 'select';
  useEffect(() => {
    const element = container.current?.getStage()?.container().parentElement;
    const cancel = () => {
      const active = dragging.current;
      dragging.current = null;
      if (!active) return;
      active.node.stopDrag();
      active.node.position(active.stair);
      store.getState().select([active.stair.id]);
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    element?.addEventListener('keydown', key);
    element?.addEventListener('pointercancel', cancel);
    return () => {
      cancel();
      element?.removeEventListener('keydown', key);
      element?.removeEventListener('pointercancel', cancel);
    };
  }, [store, disabled, tool]);

  const select = (id: string, event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!selectable) return;
    event.cancelBubble = true;
    clickSelect(store, id, event.evt as MouseEvent);
  };
  const drop = (stair: Stair, event: KonvaEventObject<DragEvent>) => {
    event.cancelBubble = true;
    const target = event.target;
    if (!dragging.current) return;
    dragging.current = null;
    const state = store.getState();
    const origin = state.document.stairs?.find((item) => item.id === stair.id);
    const to = snapObject(state.document, { ...(origin ?? stair), ...target.position() }, scale, state.snap);
    // Reset Konva's transient transform before committing the canonical document.
    target.position(origin ?? stair);
    if (!origin || state.readOnly || state.tool !== 'select' || disabled) return;
    try {
      state.apply(moveEntity(state.document, stair.id, { x: to.x - origin.x, y: to.y - origin.y }));
    } catch (error) {
      state.setError(error instanceof Error ? error.message : 'No se pudo mover la escalera');
    }
    state.select([stair.id]);
  };

  return <Group ref={container}>
    {models.map(({ stair, layout, ascent }) => {
      const active = selection.includes(stair.id);
      const finish = walkableSurfaceFinish(stair.materialId, stair.color);
      return <Group key={stair.id} x={stair.x} y={stair.y} rotation={stair.rotation}
        name={`stair:${stair.id}`} listening={!disabled}
        draggable={selectable && !readOnly && !active}
        onClick={(event) => select(stair.id, event)} onTap={(event) => select(stair.id, event)}
        onDragStart={(event) => {
          event.cancelBubble = true;
          dragging.current = { node: event.target, stair };
          store.getState().select([]);
        }}
        onDragMove={(event) => {
          event.cancelBubble = true;
          event.target.position(snapSpatialDrag(store, { ...stair, ...event.target.position() }, scale));
        }}
        onDragEnd={(event) => drop(stair, event)}>
        <Line points={layout.outline.flatMap((point) => [point.x, point.y])} closed
          fill={stair.color ?? (active ? '#dcf0ea' : '#ede5d8')} stroke={active ? ACCENT : INK} strokeWidth={2 * unit} />
        {layout.steps.map((step, index) => <Group key={`step:${index}`}>
          <FloorSurface points={[{ x: step.x, y: step.y }, { x: step.x + step.widthMm, y: step.y }, { x: step.x + step.widthMm, y: step.y + step.depthMm }, { x: step.x, y: step.y + step.depthMm }]}
            finish={finish} selected={active} scale={scale}
            onSelect={selectable ? () => store.getState().select([stair.id]) : undefined} />
          <Rect x={step.x} y={step.y} width={step.widthMm} height={step.depthMm}
            fillEnabled={false} stroke={active ? ACCENT : INK} strokeWidth={0.8 * unit} listening={false} />
        </Group>)}
        {layout.landings.map((landing, index) => <Group key={`landing:${index}`}>
          <FloorSurface points={[{ x: landing.x, y: landing.y }, { x: landing.x + landing.widthMm, y: landing.y }, { x: landing.x + landing.widthMm, y: landing.y + landing.depthMm }, { x: landing.x, y: landing.y + landing.depthMm }]}
            finish={finish} selected={active} scale={scale}
            onSelect={selectable ? () => store.getState().select([stair.id]) : undefined} />
          <Rect x={landing.x} y={landing.y} width={landing.widthMm} height={landing.depthMm}
            fillEnabled={false} stroke={active ? ACCENT : INK} strokeWidth={unit} listening={false} />
        </Group>)}
        <Arrow points={ascent} stroke={ACCENT} fill={ACCENT} strokeWidth={1.5 * unit}
          pointerLength={7 * unit} pointerWidth={6 * unit} listening={false} />
        <Text x={0} y={stair.depthMm + 5 * unit} width={stair.widthMm} align="center"
          text={`Escalera ${stair.kind === 'straight' ? 'recta' : stair.kind} · sube`}
          fontSize={11 * unit} fill={active ? ACCENT : INK} listening={false} />
      </Group>;
    })}
  </Group>;
}
