'use client';
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { Arc, Group, Line, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { EditorDocument, Opening, Point } from '@/lib/editor-document/schema';
import { openingConstruction } from '@/lib/editor-document/construction-properties';
import { placeOpening, resolveOpeningPlacement, type OpeningPlacement } from '@/canvas/editor-v2/opening-placement';
import { newId } from '@/canvas/editor-v2/editing-operations';
import { wallPath } from '@/lib/editor-document/wall-path';

const GREEN = '#087f75', RED = '#ba302f', INK = '#343b3a';
function Symbol({ opening, thickness, scale, active = false }: {
  opening: Opening; thickness: number; scale: number; active?: boolean;
}) {
  const props = openingConstruction(opening), hinge = props.hinge === 'left' ? -1 : 1;
  const side = props.swing === 'left' ? 1 : -1;
  const radians = props.openAngleDeg * Math.PI / 180;
  return <>
    <Rect x={-opening.widthMm / 2} y={-thickness / 2} width={opening.widthMm} height={thickness}
      fill={opening.colors?.frame ?? '#fafcfb'} stroke={active ? GREEN : INK} strokeWidth={(active ? 2 : 1) / scale}
      hitStrokeWidth={16 / scale} />
    {opening.kind === 'ventana' && <Line points={[-opening.widthMm / 2, 0, opening.widthMm / 2, 0]}
      stroke={GREEN} strokeWidth={3 / scale} />}
    {opening.kind === 'puerta' && <Group x={hinge * opening.widthMm / 2} scaleX={-hinge} scaleY={side}>
      <Arc innerRadius={opening.widthMm} outerRadius={opening.widthMm} angle={props.openAngleDeg}
        stroke={INK} strokeWidth={1 / scale} listening={false} />
      <Line points={[0, 0, opening.widthMm * Math.cos(radians), opening.widthMm * Math.sin(radians)]}
        stroke={opening.colors?.leaf ?? INK} strokeWidth={3 / scale} />
    </Group>}
  </>;
}

/** Provisional openings never enter history. Drag commits one validated host change. */
export function OpeningLayer({ store, scale, disabled = false, documentPreview }: { store: EditorStore; scale: number; disabled?: boolean; documentPreview?: EditorDocument }) {
  const source = useStore(store, (s) => s.document), tool = useStore(store, (s) => s.tool);
  const doc = documentPreview ?? source;
  const selected = useStore(store, (s) => s.selection), readOnly = useStore(store, (s) => s.readOnly);
  const pending = useStore(store, (s) => s.pendingOpening);
  const group = useRef<Konva.Group>(null), dragged = useRef<{ node: Konva.Group; origin: Point; offset: number } | null>(null);
  const candidateHost = useRef<string | undefined>(undefined);
  const grabPointer = useRef<Point | null>(null);
  const [preview, setPreview] = useState<{ opening: Opening; placement: OpeningPlacement | null; pointer: Point } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const placing = !disabled && !readOnly && ['door', 'window', 'passage'].includes(tool);
  useEffect(() => {
    const stage = group.current?.getStage();
    if (!stage) return;
    const kind = tool === 'window' ? 'ventana' : tool === 'passage' ? 'hueco' : 'puerta';
    const prototype: Opening = pending ?? { id: newId(), kind, wallId: '', position: .5,
      widthMm: kind === 'ventana' ? 1200 : 900, dimensionalOrigin: 'physical' };
    const move = () => {
      if (!placing) return;
      const pointer = stage.getRelativePointerPosition(); if (!pointer) return;
      const placement = resolveOpeningPlacement(store.getState().document, pointer, scale, prototype, candidateHost.current);
      candidateHost.current = placement?.wallId;
      setPreview({ opening: prototype, placement, pointer });
    };
    const confirm = () => {
      if (!placing || store.getState().readOnly) return;
      const pointer = stage.getRelativePointerPosition(); if (!pointer) return;
      const state = store.getState(), placement = resolveOpeningPlacement(state.document, pointer, scale, prototype, candidateHost.current);
      if (!placement?.valid) { state.setError(placement?.reason ?? 'Acerca la abertura a una pared para colocarla.'); return; }
      try {
        state.apply(placeOpening(state.document, prototype, placement)); state.setTool('select');
        state.select([prototype.id]); setPreview(null);
      } catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo colocar la abertura'); }
    };
    const cancel = (event?: KeyboardEvent) => {
      if (event && event.key !== 'Escape') return;
      const active = dragged.current; dragged.current = null;
      active?.node.stopDrag();
      if (active) active.node.position(active.origin);
      candidateHost.current = undefined; setPreview(null); setDragId(null);
      if (placing) store.getState().setTool('select');
    };
    stage.on('pointermove.opening', move); stage.on('click.opening tap.opening', confirm);
    const element = stage.container().parentElement;
    element?.addEventListener('keydown', cancel);
    const cancelPointer = () => cancel();
    element?.addEventListener('pointercancel', cancelPointer);
    return () => { stage.off('.opening'); element?.removeEventListener('keydown', cancel);
      element?.removeEventListener('pointercancel', cancelPointer); };
  }, [placing, scale, store, tool, pending]);
  const visiblePreview = !disabled && !readOnly && (placing || dragId) ? preview : null;
  const candidate = visiblePreview?.placement;
  const host = candidate && doc.walls.find((w) => w.id === candidate.wallId);
  return <Group ref={group}>
    {host && <Line points={wallPath(doc, host).samples().flatMap((p) => [p.x, p.y])} listening={false}
      stroke={candidate?.valid ? GREEN : RED} opacity={.65} strokeWidth={host.thicknessMm + 6 / scale} />}
    {doc.openings.map((opening) => {
      const wall = doc.walls.find((w) => w.id === opening.wallId)!, path = wallPath(doc, wall), direction = path.tangent(opening.position);
      const center = path.at(opening.position), angle = Math.atan2(direction.y, direction.x) * 180 / Math.PI;
      return <Group key={opening.id} x={center.x} y={center.y} rotation={angle} opacity={dragId === opening.id ? .35 : 1}
        draggable={!disabled && !readOnly && tool === 'select'}
        onPointerDown={(event) => { grabPointer.current = event.target.getStage()?.getRelativePointerPosition() ?? null; }}
        onClick={(event) => { if (tool === 'select') { event.cancelBubble = true; store.getState().select([opening.id]); } }}
        onTap={(event) => { if (tool === 'select') { event.cancelBubble = true; store.getState().select([opening.id]); } }}
        onDragStart={(event) => {
          candidateHost.current = opening.wallId;
          const pointer = grabPointer.current ?? event.target.getStage()?.getRelativePointerPosition();
          const radians = angle * Math.PI / 180;
          dragged.current = { node: event.target as Konva.Group, origin: center,
            offset: pointer ? (pointer.x - center.x) * Math.cos(radians) + (pointer.y - center.y) * Math.sin(radians) : 0 };
          setDragId(opening.id); store.getState().select([]);
        }} onDragMove={(event) => {
          const pointer = event.target.getStage()?.getRelativePointerPosition(); if (!pointer) return;
          event.target.position(center);
          const placement = resolveOpeningPlacement(store.getState().document, pointer, scale, opening, candidateHost.current, dragged.current?.offset);
          candidateHost.current = placement?.wallId; setPreview({ opening, placement, pointer });
        }} onDragEnd={(event) => {
          event.target.position(center);
          if (!dragged.current) return;
          const offset = dragged.current.offset; dragged.current = null;
          const pointer = event.target.getStage()?.getRelativePointerPosition();
          const state = store.getState(), current = state.document.openings.find((o) => o.id === opening.id);
          const placement = pointer && current && resolveOpeningPlacement(state.document, pointer, scale, current, candidateHost.current, offset);
          try {
            if (!placement?.valid || !current) throw new Error(placement?.reason ?? 'No hay una pared válida. Se conserva la ubicación anterior.');
            state.apply(placeOpening(state.document, current, placement));
          } catch (error) { state.setError(error instanceof Error ? error.message : 'Ubicación inválida'); }
          candidateHost.current = undefined;
          setDragId(null); setPreview(null); state.select([opening.id]);
        }}>
        <Symbol opening={opening} thickness={wall.thicknessMm} scale={scale} active={selected.includes(opening.id)} />
      </Group>;
    })}
    {visiblePreview && <Group listening={false} x={candidate?.center.x ?? visiblePreview.pointer.x} y={candidate?.center.y ?? visiblePreview.pointer.y}>
      <Group rotation={candidate?.rotation ?? 0} opacity={.85}>
        <Symbol opening={visiblePreview.opening} thickness={host?.thicknessMm ?? 150} scale={scale} active />
      </Group>
      <Text x={-130 / scale} y={-48 / scale} width={260 / scale} align="center" fontSize={13 / scale}
        fill={candidate?.valid ? GREEN : RED} text={candidate?.valid
          ? `Encaja · ${(candidate.beforeMm / 1000).toFixed(2)} m | ${(candidate.afterMm / 1000).toFixed(2)} m`
          : candidate?.reason ?? 'Acerca a una pared'} />
    </Group>}
  </Group>;
}
