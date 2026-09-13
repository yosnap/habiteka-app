'use client';

import { useRef, useState } from 'react';
import { useStore } from 'zustand';
import { Arrow, Circle, Group, Line, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { moveEntity } from '@/canvas/editor-v2/editing-operations';
import { updateRamp } from '@/lib/editor-document/construction-commands';
import { snapObject } from '@/canvas/editor-v2/spatial-placement';
import { rampLayout } from '@/lib/editor-document/ramp-layout';
import { rampParts } from '@/lib/editor-document/ramp-route';
import { isRampLanding } from '@/lib/editor-document/ramp-kind';
import type { EditorDocument, Ramp } from '@/lib/editor-document/schema';
import { objectClearances } from '@/canvas/editor-v2/object-clearances';
import { DimensionMark } from './dimension-mark';
import { rampArrival } from '@/lib/editor-document/ramp-arrival';
import { placeLandingAtRampArrival } from '@/lib/editor-document/ramp-landing-placement';

interface RampLayerProps { store: EditorStore; scale: number; disabled?: boolean; documentPreview?: EditorDocument; }
const INK = '#52615c', ACCENT = '#087f75';

export function RampLayer({ store, scale, disabled = false, documentPreview }: RampLayerProps) {
  const dragging = useRef<{ node: Konva.Node; ramp: Ramp } | null>(null);
  const [guideRamp, setGuideRamp] = useState<Ramp | null>(null);
  const source = useStore(store, (state) => state.document.ramps);
  const ramps = documentPreview?.ramps ?? source, selection = useStore(store, (state) => state.selection);
  const tool = useStore(store, (state) => state.tool), readOnly = useStore(store, (state) => state.readOnly);
  const unit = 1 / Math.max(scale, 0.0001), selectable = !disabled && tool === 'select';
  const select = (id: string, event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!selectable) return;
    event.cancelBubble = true; store.getState().select([id]);
  };
  const drop = (ramp: Ramp, event: KonvaEventObject<DragEvent>) => {
    event.cancelBubble = true; const state = store.getState(), target = event.target;
    const origin = state.document.ramps?.find((item) => item.id === ramp.id);
    target.position(origin ?? ramp); dragging.current = null; setGuideRamp(null);
    if (!origin || state.readOnly || state.tool !== 'select' || disabled) return;
    try { const to = snapObject(state.document, { ...origin, ...event.target.position() }, scale, state.snap);
      state.apply(moveEntity(state.document, ramp.id, { x: to.x - origin.x, y: to.y - origin.y })); }
    catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo mover la rampa'); }
    state.select([ramp.id]);
  };
  const resizePart = (ramp: Ramp, index: number, event: KonvaEventObject<DragEvent>) => {
    event.cancelBubble = true;
    const state = store.getState(), target = event.target, value = Math.max(500, Math.round(target.y() / 100) * 100);
    target.y(index === 0 ? ramp.depthMm : index === 1 ? ramp.route!.landingMm : ramp.route!.secondDepthMm);
    if (state.readOnly || disabled) return;
    try { state.apply(updateRamp(state.document, ramp.id, index === 0 ? { depthMm: value }
      : index === 1 ? { route: { ...ramp.route!, landingMm: value } } : { route: { ...ramp.route!, secondDepthMm: value } })); }
    catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo ajustar el tramo'); }
  };
  const resizeWidth = (ramp: Ramp, event: KonvaEventObject<DragEvent>) => {
    event.cancelBubble = true;
    const state = store.getState(), target = event.target, value = Math.max(500, Math.round(target.x() / 100) * 100);
    target.x(ramp.widthMm);
    if (state.readOnly || disabled) return;
    try { state.apply(updateRamp(state.document, ramp.id, { widthMm: value })); }
    catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo ajustar el ancho'); }
  };
  const rotateSecondFlight = (ramp: Ramp) => {
    const state = store.getState(); if (state.readOnly || disabled || !ramp.route) return;
    const turns = ['left', 'right', 'reverse'] as const, index = turns.indexOf(ramp.route.turn);
    try { state.apply(updateRamp(state.document, ramp.id, { route: { ...ramp.route, turn: turns[(index + 1) % turns.length]! } })); }
    catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo girar el tramo'); }
  };
  const movePart = (ramp: Ramp, index: number, part: { x: number; y: number }, event: KonvaEventObject<DragEvent>) => {
    event.cancelBubble = true; const state = store.getState(), target = event.target;
    const x = Math.round(target.x() / 100) * 100, y = Math.round(target.y() / 100) * 100;
    target.position(part);
    if (state.readOnly || disabled || !ramp.route || index === 0) return;
    const current = ramp.route[index === 1 ? 'landingOffset' : 'secondOffset'] ?? { x: 0, y: 0 };
    const offset = { x: current.x + x - part.x, y: current.y + y - part.y };
    try { state.apply(updateRamp(state.document, ramp.id, { route: { ...ramp.route, ...(index === 1 ? { landingOffset: offset } : { secondOffset: offset }) } })); }
    catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo ubicar la parte'); }
  };
  return <Group>{(ramps ?? []).map((ramp) => {
    const active = selection.includes(ramp.id), layout = rampLayout(ramp);
    const parts = rampParts(ramp);
    return <Group key={ramp.id} x={ramp.x} y={ramp.y} rotation={ramp.rotation} name={`ramp:${ramp.id}`}
      draggable={selectable && !readOnly} onClick={(event) => select(ramp.id, event)} onTap={(event) => select(ramp.id, event)}
      onDragStart={(event) => { event.cancelBubble = true; dragging.current = { node: event.target, ramp }; setGuideRamp(ramp); store.getState().select([ramp.id]); }}
      onDragMove={(event) => { event.cancelBubble = true; const state = store.getState();
        const snapped = snapObject(state.document, { ...ramp, ...event.target.position() }, scale, state.snap) as Ramp;
        event.target.position(snapped); setGuideRamp(snapped); }}
      onDragEnd={(event) => drop(ramp, event)}>
      {parts.map((part, index) => <Group key={index} x={part.x} y={part.y} rotation={part.rotation} listening={selectable}
        draggable={index > 0 && active && !readOnly && !disabled} onClick={(event) => select(ramp.id, event)} onTap={(event) => select(ramp.id, event)}
        onDragEnd={(event) => movePart(ramp, index, part, event)}>
        <Line points={[0, 0, ramp.widthMm, 0, ramp.widthMm, part.depthMm, 0, part.depthMm]} closed
          fill={ramp.color ?? (active ? '#dcf0ea' : '#d8d5cc')} stroke={active ? ACCENT : INK} strokeWidth={2 * unit} />
        {part.kind === 'flight' && <Arrow points={[ramp.widthMm / 2, part.depthMm - 16 * unit, ramp.widthMm / 2, 16 * unit]} stroke={ACCENT} fill={ACCENT}
          strokeWidth={1.5 * unit} pointerLength={7 * unit} pointerWidth={6 * unit} />}
        {active && <Text x={0} y={part.depthMm / 2 - 6 * unit} width={ramp.widthMm} align="center" rotation={-(ramp.rotation + part.rotation)}
          text={part.kind === 'landing' ? `Descanso ${(part.depthMm / 1000).toFixed(2)} m` : `Tramo ${index === 0 ? 1 : 2} · ${(part.depthMm / 1000).toFixed(2)} m`}
          fontSize={11 * unit} fill={ACCENT} />}
      </Group>)}
      {active && parts.map((part, index) => <Group key={`handle:${index}`} x={part.x} y={part.y} rotation={part.rotation}>
        <Circle x={ramp.widthMm / 2} y={part.depthMm} radius={9 * unit} fill="white" stroke={ACCENT} strokeWidth={2 * unit}
          draggable={!readOnly && !disabled} onDragEnd={(event) => resizePart(ramp, index, event)} />
      </Group>)}
      {active && <Circle x={ramp.widthMm} y={ramp.depthMm / 2} radius={9 * unit} fill="white" stroke={ACCENT} strokeWidth={2 * unit}
        draggable={!readOnly && !disabled} onDragEnd={(event) => resizeWidth(ramp, event)} />}
      {active && ramp.route && <Group x={parts[1]!.x} y={parts[1]!.y} onClick={(event) => { event.cancelBubble = true; rotateSecondFlight(ramp); }}
        onTap={(event) => { event.cancelBubble = true; rotateSecondFlight(ramp); }}>
        <Circle x={ramp.widthMm / 2} y={parts[1]!.depthMm / 2} radius={14 * unit} fill="white" stroke={ACCENT} strokeWidth={2 * unit} />
        <Text x={ramp.widthMm / 2 - 10 * unit} y={parts[1]!.depthMm / 2 - 8 * unit} text="↻" fontSize={16 * unit} fill={ACCENT} listening={false} />
      </Group>}
      {!active && <Text x={0} y={ramp.depthMm + 5 * unit} width={ramp.widthMm} align="center" rotation={-ramp.rotation}
        text={isRampLanding(ramp) ? `Descansillo · ${(ramp.elevationMm / 1000).toFixed(2)} m` : `Rampa · ${layout.slopePercent.toFixed(1)}% · sube`}
        fontSize={11 * unit} fill={INK} listening={false} />}
    </Group>;
    })}{guideRamp && <AlignmentGuides document={documentPreview ?? store.getState().document} ramp={guideRamp} scale={scale} />}</Group>;
}

function AlignmentGuides({ document, ramp, scale }: { document: EditorDocument; ramp: Ramp; scale: number }) {
  const clearances = objectClearances(document, ramp);
  const host = isRampLanding(ramp) ? document.ramps?.filter((item) => !isRampLanding(item)).map((item) => ({ item,
    target: placeLandingAtRampArrival(ramp, item) })).find(({ target }) => Math.hypot(target.x - ramp.x, target.y - ramp.y) < 2) : undefined;
  if (!host) return <>{clearances.map((guide, index) => <DimensionMark key={index} scale={scale}
    layout={{ from: guide.from, to: guide.to, sourceFrom: guide.from, sourceTo: guide.to }} />)}</>;
  const arrival = rampArrival(host.item), angle = host.item.rotation * Math.PI / 180;
  const width = host.item.widthMm / 2, axis = { x: Math.cos(angle), y: Math.sin(angle) };
  return <><Line points={[arrival.point.x - axis.x * width, arrival.point.y - axis.y * width,
    arrival.point.x + axis.x * width, arrival.point.y + axis.y * width]} stroke={ACCENT} strokeWidth={3 / scale} dash={[8 / scale, 5 / scale]} listening={false} />
    {clearances.map((guide, index) => <DimensionMark key={index} scale={scale}
      layout={{ from: guide.from, to: guide.to, sourceFrom: guide.from, sourceTo: guide.to }} />)}</>;
}
