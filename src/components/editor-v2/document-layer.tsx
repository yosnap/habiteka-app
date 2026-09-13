'use client';
import { useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { Group, Line, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { ObjectTransformControls } from './object-transform-controls';
import { CommentMarkers } from './comment-markers';
import { OpeningResizeControls } from './opening-resize-controls';
import { wallPoints } from '@/lib/editor-document/geometry';
import { deriveRooms } from '@/lib/editor-document/rooms';
import type { VertexPreview } from '@/canvas/editor-v2/vertex-preview';
import { VertexHandles } from './vertex-handles';
import { interiorPoint, moveEntity, snapPoint } from '@/canvas/editor-v2/editing-operations';
import { CATALOG_BY_KIND } from '@/canvas/catalog';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { FurnitureSymbol } from './furniture-symbol';
import { wallJunctions } from '@/canvas/editor-v2/wall-junctions';
import { wallDimensionLayout } from '@/canvas/editor-v2/dimension-layout';
import { snapObject } from '@/canvas/editor-v2/spatial-placement';
import { DimensionMark } from './dimension-mark';
import { StairLayer } from './stair-layer';
import { RampLayer } from './ramp-layer';
import { OpeningLayer } from './opening-layer';
import { WALL_PLAN_COLOR } from '@/lib/editor-document/wall-appearance';
import { floorFinish } from '@/lib/editor-document/floor-finishes';
import { FloorSurface } from './floor-surface';
import { wallPath, wallStrip } from '@/lib/editor-document/wall-path';
import { CurveHandle } from './curve-handle';

const INK = WALL_PLAN_COLOR, ACCENT = '#087f75', PAPER = '#fafcfb';
export function DocumentLayer({ store, scale, disabled = false }: { store: EditorStore; scale: number; disabled?: boolean }) {
  const source = useStore(store, (s) => s.document), selected = useStore(store, (s) => s.selection);
  const [preview, setPreview] = useState<VertexPreview | null>(null);
  const [objectPreview, setObjectPreview] = useState<EditorDocument | null>(null);
  const doc = !disabled ? preview?.document ?? objectPreview ?? source : source;
  const tool = useStore(store, (s) => s.tool);
  const readOnly = useStore(store, (s) => s.readOnly);
  const junctions = useMemo(() => wallJunctions(doc), [doc]);
  const rooms = useMemo(() => {
    try { return { value: deriveRooms(doc), error: null }; }
    catch (error) { return { value: [], error: error instanceof Error ? error.message : 'Contorno incompleto' }; }
  }, [doc]);
  const run = (operation: () => void) => {
    try { operation(); } catch (error) { store.getState().setError(error instanceof Error ? error.message : 'Edición inválida'); }
  };
  const choose = (id: string, e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (tool !== 'select') return;
    e.cancelBubble = true; store.getState().select([id]);
  };
  const drag = (id: string, origin: Point, e: KonvaEventObject<DragEvent>) => {
    const target = e.target, state = store.getState();
    const object = state.document.furniture.find((f) => f.id === id);
    const to = object ? snapObject(state.document, { ...object, ...target.position() }, scale, state.snap)
      : snapPoint(state.document, target.position(), state.snap);
    target.position(origin);
    run(() => state.apply(moveEntity(state.document, id, { x: to.x - origin.x, y: to.y - origin.y })));
    if (object) state.select([id]);
  };
  return <Group listening={!disabled}>
    {rooms.value.map((room) => {
      const points = room.boundary;
      return <FloorSurface key={room.id} points={points} finish={floorFinish(doc, room.id)} scale={scale}
        selected={selected.includes(room.id)} onSelect={tool === 'select' ? () => store.getState().select([room.id]) : undefined} />;
    })}
    {rooms.error && <Text text={rooms.error} x={0} y={-500} fontSize={13 / scale} fill={INK} listening={false} />}
    {junctions.map((join) => <Line key={`join:${join.id}`} points={join.points.flatMap((p) => [p.x, p.y])}
      closed fill={INK} listening={false} />)}
    {doc.walls.map((wall) => {
      const [a, b] = wallPoints(doc, wall), active = selected.includes(wall.id);
      return <Group key={wall.id} draggable={!readOnly && tool === 'select'}
        onDragStart={() => store.getState().select([wall.id])}
        onDragEnd={(e) => drag(wall.id, { x: 0, y: 0 }, e)}
        onClick={(e) => choose(wall.id, e)} onTap={(e) => choose(wall.id, e)}>
        {wall.curveHeightMm ? <Line points={wallStrip(doc, wall).flatMap((p) => [p.x, p.y])} closed fill={active ? ACCENT : INK} />
          : <Line points={[a.x, a.y, b.x, b.y]} stroke={preview?.error ? '#ba302f' : active ? ACCENT : INK}
            lineCap="butt" strokeWidth={wall.thicknessMm} hitStrokeWidth={Math.max(wall.thicknessMm, 18 / scale)} />}
        <DimensionMark layout={wallDimensionLayout(doc, wall, rooms.value, scale)} scale={scale}
          label={wall.curveHeightMm ? `${(wallPath(doc, wall).length / 1000).toFixed(2)} m · arco` : undefined} />
      </Group>;
    })}
    <OpeningLayer store={store} scale={scale} disabled={disabled || !!preview} documentPreview={doc} />
    <StairLayer store={store} scale={scale} disabled={disabled} documentPreview={doc} />
    <RampLayer store={store} scale={scale} disabled={disabled} documentPreview={doc} />
    {doc.furniture.map((f) => <Group key={f.id} x={f.x} y={f.y} rotation={f.rotation}
      draggable={!readOnly && tool === 'select' && !selected.includes(f.id)} onDragStart={() => store.getState().select([])}
      onDragEnd={(e) => drag(f.id, f, e)} onClick={(e) => choose(f.id, e)} onTap={(e) => choose(f.id, e)}>
      {getFurnitureCatalogEntry(f.catalogId) ? <FurnitureSymbol item={f} scale={scale} selected={selected.includes(f.id)} /> : <><Rect width={f.widthMm} height={f.depthMm} cornerRadius={Math.min(80, f.widthMm / 10)}
        fill={f.color ?? '#d8e2de'} stroke={selected.includes(f.id) ? ACCENT : '#65776e'} strokeWidth={2 / scale} />
      <Line points={[0, f.depthMm * .25, f.widthMm, f.depthMm * .25]} stroke="#65776e" strokeWidth={1 / scale} listening={false} /></>}
      <Text text={getFurnitureCatalogEntry(f.catalogId)?.label ?? CATALOG_BY_KIND[f.kind]?.label ?? f.kind} x={0} y={f.depthMm / 2}
        width={f.widthMm} align="center" fontSize={11 / scale} fill={INK} listening={false} />
    </Group>)}
    {doc.dimensions.map((d) => <DimensionMark key={d.id} scale={scale} label={d.label}
      layout={{ from: d.from, to: d.to, sourceFrom: d.from, sourceTo: d.to }}
      onSelect={tool === 'select' ? () => store.getState().select([d.id]) : undefined} />)}
    {doc.labels.map((label) => <Text key={label.id} {...label} text={label.text} fontSize={14 / scale}
      fill={INK} draggable={!readOnly && tool === 'select'} onDragEnd={(e) => drag(label.id, label, e)}
      onClick={(e) => choose(label.id, e)} onTap={(e) => choose(label.id, e)} />)}
    {rooms.value.map((room) => {
      const p = interiorPoint(room.boundary);
      return <Group key={`area:${room.id}`} x={p.x} y={p.y} listening={false}>
        <Rect x={-45 / scale} y={-12 / scale} width={90 / scale} height={24 / scale} fill={PAPER} cornerRadius={4 / scale} />
        <Text x={-45 / scale} y={-7 / scale} width={90 / scale} align="center"
          text={`${(room.areaMm2 / 1e6).toFixed(2)} m²`} fontSize={13 / scale} fill={INK} />
      </Group>;
    })}
    {!readOnly && !disabled && tool === 'select' && <VertexHandles store={store} source={source} scale={scale}
      selected={selected} preview={preview} onPreview={setPreview} />}
    {!readOnly && !disabled && tool === 'select' && doc.walls.filter((w) => selected.includes(w.id) && w.curveHeightMm).map((wall) =>
      <CurveHandle key={wall.id} doc={doc} wall={wall} store={store} scale={scale} onPreview={setObjectPreview} />)}
    {!readOnly && !disabled && tool === 'select' && selected.length === 1 && <ObjectTransformControls
      key={selected[0]} store={store} source={source} id={selected[0]!} scale={scale} onPreview={setObjectPreview} />}
    {!readOnly && !disabled && tool === 'select' && selected.length === 1 && <OpeningResizeControls
      key={`opening:${selected[0]}`} store={store} source={source} preview={doc} id={selected[0]!} scale={scale} onPreview={setObjectPreview} />}
    <CommentMarkers doc={doc} store={store} scale={scale} />
  </Group>;
}
