'use client';
import { planObjects } from '@/lib/editor-document/boundary-types';
import { linearPartOwner } from '@/lib/editor-document/linear-part-owner';
import { isKitchenRun } from '@/lib/editor-document/kitchen-run-types';
import { elementName } from '@/lib/editor-document/element-classification';

import { snapSpatialDrag, snapPointDrag } from './magnetic-drag';
import { alignRoom, alignPoints } from '@/canvas/editor-v2/magnetic-alignment';
import { useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { Group, Line, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { EditorDocument, Furniture, Point } from '@/lib/editor-document/schema';
import { updateFurniture } from '@/lib/editor-document/spatial-commands';
import { WalkthroughLayer } from './walkthrough-layer';
import { CeilingLightingLayer } from './ceiling-lighting-layer';
import { LightStripLayer } from './light-strip-layer';
import { ObjectTransformControls } from './object-transform-controls';
import { CommentMarkers } from './comment-markers';
import { OpeningResizeControls } from './opening-resize-controls';
import { wallPoints } from '@/lib/editor-document/geometry';
import { deriveRooms, RoomConflictError } from '@/lib/editor-document/rooms';
import type { VertexPreview } from '@/canvas/editor-v2/vertex-preview';
import { VertexHandles } from './vertex-handles';
import { interiorPoint, moveEntity, nudgeSpatialEntities } from '@/canvas/editor-v2/editing-operations';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { FurnitureSymbol } from './furniture-symbol';
import { wallJunctions, wallMiterPolygon } from '@/canvas/editor-v2/wall-junctions';
import { wallDimensionLayout } from '@/canvas/editor-v2/dimension-layout';
import type { DimensionVisibility } from './visibility-menu';
import { snapObject } from '@/canvas/editor-v2/spatial-placement';
import { DimensionMark } from './dimension-mark';
import { StairLayer } from './stair-layer';
import { RampLayer } from './ramp-layer';
import { OpeningLayer } from './opening-layer';
import { WALL_PLAN_COLOR } from '@/lib/editor-document/wall-appearance';
import { localToWorld, projectAlong } from '@/lib/editor-document/spatial-properties';
import { floorFinish } from '@/lib/editor-document/floor-finishes';
import { editableOutdoorRoom, moveOutdoorRoom } from '@/lib/editor-document/outdoor-editing';
import { roomAt } from '@/lib/editor-document/outdoor-attach';
import { duplicateSpatialItem, insertSpatialItem } from '@/canvas/editor-v2/spatial-clipboard';
import { clickSelect } from '@/canvas/editor-v2/selection-click';
import { insideRoom } from '@/lib/editor-document/ceiling-geometry';
import { FloorSurface } from './floor-surface';
import { wallPath, wallStrip } from '@/lib/editor-document/wall-path';
import { CurveHandle } from './curve-handle';
import { ColumnLayer } from './column-layer';
import { snapWallMove, type WallMoveSnap } from '@/canvas/editor-v2/wall-move-snap';

const INK = WALL_PLAN_COLOR, ACCENT = '#087f75', PAPER = '#fafcfb';
export function DocumentLayer({ store, scale, disabled = false, dimensions = 'all', showFurniture = true, showWalls = true, showLighting = true, referenceVisible = false }: { store: EditorStore; scale: number; disabled?: boolean; dimensions?: DimensionVisibility; showFurniture?: boolean; showWalls?: boolean; showLighting?: boolean; referenceVisible?: boolean }) {
  const source = useStore(store, (s) => s.document), selected = useStore(store, (s) => s.selection);
  const [preview, setPreview] = useState<VertexPreview | null>(null);
  const [objectPreview, setObjectPreview] = useState<EditorDocument | null>(null);
  const [wallMoveSnap, setWallMoveSnap] = useState<WallMoveSnap | null>(null);
  const doc = !disabled ? preview?.document ?? objectPreview ?? source : source;
  const tool = useStore(store, (s) => s.tool);
  const readOnly = useStore(store, (s) => s.readOnly);
  const visibleWalls = doc.walls.filter((wall) => !wall.hidden && showWalls);
  const wallInk = referenceVisible ? '#df254b' : INK;
  // Muros que el usuario ocultó: se ven como guía discontinua y se pueden seleccionar para volver a mostrarlos.
  // Los bordes lógicos de patios y del perímetro exterior no son muros del usuario y siguen sin dibujarse.
  const ghostWalls = doc.walls.filter((wall) => wall.hidden && showWalls && !wall.id.startsWith('hidden:') && !wall.id.startsWith('outdoor:'));
  const junctions = useMemo(() => wallJunctions({ ...doc, walls: doc.walls.filter((wall) => !wall.hidden) }), [doc]);
  const rooms = useMemo(() => {
    try { return { value: deriveRooms(doc), error: null }; }
    catch (error) { return { value: [], error: error instanceof Error ? error.message : 'Contorno incompleto' }; }
  }, [doc]);
  const run = (operation: () => void) => {
    try { operation(); } catch (error) {
      store.getState().setError(error instanceof Error ? error.message : 'Edición inválida');
      // Un conflicto geométrico se señala con una cruz en el punto exacto para que se vea dónde choca.
      if (error instanceof RoomConflictError) { const { x, y } = error.point, arm = 400; store.getState().setMagneticGuides([
        { from: { x: x - arm, y: y - arm }, to: { x: x + arm, y: y + arm } }, { from: { x: x - arm, y: y + arm }, to: { x: x + arm, y: y - arm } }]); }
    }
  };
  // Ctrl, Cmd o Mayús con clic añaden o quitan el elemento de la selección actual.
  const choose = (id: string, e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (tool !== 'select') return;
    e.cancelBubble = true;
    clickSelect(store, id, e.evt as MouseEvent);
  };
  // Arrastrar un elemento que forma parte de una selección múltiple desplaza toda la selección de una vez.
  const groupOf = (id: string) => { const ids = store.getState().selection; return ids.length > 1 && ids.includes(id) ? ids : null; };
  const dragGroup = (ids: string[], delta: Point) => run(() => { store.getState().apply(nudgeSpatialEntities(source, ids, delta)); store.getState().select(ids); });
  const drag = (id: string, origin: Point, e: KonvaEventObject<DragEvent>) => {
    const target = e.target, state = store.getState();
    const group = groupOf(id), at = target.position();
    // Un arrastre de un par de píxeles es un clic: se selecciona sin mover nada.
    if (Math.hypot(at.x - origin.x, at.y - origin.y) < 4 / scale) { target.position(origin); setWallMoveSnap(null); state.select(group ?? [id]); return; }
    if (group) { target.position(origin); return dragGroup(group, { x: at.x - origin.x, y: at.y - origin.y }); }
    const wall = state.document.walls.find((item) => item.id === id);
    const object = planObjects(state.document).find((f) => f.id === id);
    const to = wall ? snapWallMove(state.document, wall, target.position(), scale, state.snap).delta
      : object ? snapObject(state.document, { ...object, ...target.position() }, scale, state.snap)
        : target.position();
    target.position(origin);
    // Alt + arrastrar: el original se queda y se coloca una copia donde se suelta.
    if (object && (e.evt as MouseEvent).altKey) {
      const copy = { ...duplicateSpatialItem(object), x: to.x, y: to.y };
      run(() => { state.apply(insertSpatialItem(state.document, copy)); store.getState().select([copy.id]); });
      return;
    }
    if (object) {
      const placed = to as Furniture;
      run(() => state.apply(updateFurniture(state.document, id, { x: placed.x, y: placed.y, rotation: placed.rotation, elevationMm: placed.elevationMm, hostId: placed.hostId })));
    } else run(() => state.apply(moveEntity(state.document, id, wall ? to : { x: to.x - origin.x, y: to.y - origin.y })));
    setWallMoveSnap(null);
    if (object) state.select([id]);
  };
  return <Group listening={!disabled}>
    {rooms.value.map((room) => {
      const points = room.boundary;
      return <FloorSurface key={room.id} points={points} finish={floorFinish(doc, room.id)} scale={scale}
        referenceVisible={referenceVisible}
        onSnapMove={(delta) => { if (groupOf(room.id)) return delta; const state = store.getState(), result = alignRoom(source, room.id, delta, scale, state.snap); state.setMagneticGuides(result.guides); return result.delta; }}
        onMove={!readOnly && tool === 'select' ? (delta) => run(() => {
          const group = groupOf(room.id); if (group) return dragGroup(group, delta);
          const outdoor = editableOutdoorRoom(source, room);
          store.getState().apply(outdoor ? moveOutdoorRoom(source, room.id, delta) : nudgeSpatialEntities(source, [room.id], delta));
          // Un patio acoplado a la casa cambia de id (comparte muros): se reselecciona por su posición.
          const centre = interiorPoint(room.boundary), moved = { x: centre.x + delta.x, y: centre.y + delta.y };
          store.getState().select([outdoor ? roomAt(store.getState().document, moved)?.id ?? room.id : room.id]);
        }) : undefined}
        selected={selected.includes(room.id)} onSelect={tool === 'select' ? () => { if (!groupOf(room.id)) store.getState().select([room.id]); } : undefined} />;
    })}
    {rooms.error && <Text text={rooms.error} x={0} y={-500} fontSize={13 / scale} fill={INK} listening={false} />}
    {/* A landing is a support surface; its fill must stay beneath the protection walls built on its perimeter. */}
    <RampLayer store={store} scale={scale} disabled={disabled} documentPreview={doc} />
    {junctions.filter((join) => doc.walls.filter((wall) => wall.startVertexId === join.id || wall.endVertexId === join.id).length !== 2)
      .map((join) => <Line key={`join:${join.id}`} points={join.points.flatMap((p) => [p.x, p.y])}
      closed fill={wallInk} opacity={referenceVisible ? 0.78 : 1} listening={false} />)}
    {visibleWalls.map((wall) => {
      const [a, b] = wallPoints(doc, wall), active = selected.includes(wall.id);
      const miter = wallMiterPolygon(doc, wall);
      return <Group key={wall.id} opacity={referenceVisible && !active ? 0.78 : 1} draggable={!readOnly && tool === 'select'}
        onDragStart={() => { if (!groupOf(wall.id)) store.getState().select([wall.id]); }}
        onDragMove={(event) => {
          if (groupOf(wall.id)) return;
          const snap = snapWallMove(source, wall, event.target.position(), scale, store.getState().snap);
          event.target.position(snap.delta); setWallMoveSnap(snap);
        }}
        onDragEnd={(e) => drag(wall.id, { x: 0, y: 0 }, e)}
        onClick={(e) => choose(wall.id, e)} onTap={(e) => choose(wall.id, e)}>
        {wall.curveHeightMm ? <Line points={wallStrip(doc, wall).flatMap((p) => [p.x, p.y])} closed fill={active ? ACCENT : wallInk} />
          : miter ? <Line points={miter.flatMap((p) => [p.x, p.y])} closed fill={active ? ACCENT : wallInk}
            hitStrokeWidth={Math.max(wall.thicknessMm, 18 / scale)} />
          : <Line points={[a.x, a.y, b.x, b.y]} stroke={preview?.error ? '#ba302f' : active ? ACCENT : wallInk}
            lineCap="butt" strokeWidth={wall.thicknessMm} hitStrokeWidth={Math.max(wall.thicknessMm, 18 / scale)} />}
        {(dimensions === 'all' || (dimensions === 'external' && rooms.value.filter((room) => room.wallIds.includes(wall.id)).length === 1)) &&
          <DimensionMark layout={wallDimensionLayout(doc, wall, rooms.value, scale)} scale={scale}
            label={wall.curveHeightMm ? `${(wallPath(doc, wall).length / 1000).toFixed(2)} m · arco` : undefined} />}
      </Group>;
    })}
    {ghostWalls.map((wall) => {
      const points = wallPath(doc, wall).samples();
      return <Line key={`ghost:${wall.id}`} points={points.flatMap((p) => [p.x, p.y])}
        stroke={selected.includes(wall.id) ? ACCENT : '#8a9591'} strokeWidth={1.5 / scale} dash={[8 / scale, 6 / scale]}
        hitStrokeWidth={Math.max(wall.thicknessMm, 18 / scale)} onClick={(e) => choose(wall.id, e)} onTap={(e) => choose(wall.id, e)} />;
    })}
    {wallMoveSnap?.guides.map((guide, index) => <Line key={`wall-move-guide:${index}`} points={[guide.from.x, guide.from.y, guide.to.x, guide.to.y]}
      stroke={ACCENT} strokeWidth={2 / scale} dash={[8 / scale, 5 / scale]} listening={false} />)}
    {showWalls && <OpeningLayer store={store} scale={scale} disabled={disabled || !!preview} documentPreview={doc} />}
    <StairLayer store={store} scale={scale} disabled={disabled} documentPreview={doc} />
    <ColumnLayer store={store} scale={scale} disabled={disabled} />
    {planObjects(doc).filter((f) => showFurniture || 'construction' in f).map((f) => <Group key={f.id} x={f.x} y={f.y} rotation={f.rotation}
      draggable={!readOnly && tool === 'select' && (!selected.includes(f.id) || selected.length > 1)} onDragStart={(e) => {
        if (groupOf(f.id)) return;
        // Con Mayús/⌘/Ctrl un clic con un leve arrastre (trackpad) no rompe la selección múltiple: el objeto se suma a ella.
        const evt = e.evt as MouseEvent, current = store.getState().selection;
        store.getState().select((evt.shiftKey || evt.metaKey || evt.ctrlKey) && current.length ? [...current.filter((id) => id !== f.id), f.id] : []);
      }}
      onDragMove={(e) => { if (groupOf(f.id)) return; const snapped = snapSpatialDrag(store, { ...f, ...e.target.position(), rotation: f.rotation }, scale); e.target.position(snapped); e.target.rotation(snapped.rotation); }}
      onDragEnd={(e) => { e.target.rotation(f.rotation); drag(f.id, f, e); }} onClick={(e) => choose(f.id, e)} onTap={(e) => choose(f.id, e)}>
      {getFurnitureCatalogEntry(f.catalogId) || isKitchenRun(f) ? <FurnitureSymbol onPartSnap={(id, delta) => {
        const owner = linearPartOwner(store.getState().document, id); if (!owner) return delta;
        const raw = localToWorld(owner.item, { x: owner.positionMm + delta, y: owner.item.depthMm / 2 });
        const snapped = snapPointDrag(store, raw, scale, [owner.item.id]);
        return projectAlong(owner.item, snapped) - owner.positionMm;
      }} onPartMove={!readOnly && tool === 'select' ? (id, delta) => run(() => {
        const owner = linearPartOwner(store.getState().document, id); if (!owner) return;
        store.getState().apply(owner.move(store.getState().document, delta));
      }) : undefined} selectedPartId={selected[0]} onPartSelect={tool === 'select' ? (id) => store.getState().select([id]) : undefined} document={doc} item={f} scale={scale} selected={selected.includes(f.id)} /> : <><Rect width={f.widthMm} height={f.depthMm} cornerRadius={Math.min(80, f.widthMm / 10)}
        fill={f.color ?? '#d8e2de'} stroke={selected.includes(f.id) ? ACCENT : '#65776e'} strokeWidth={2 / scale} />
      <Line points={[0, f.depthMm * .25, f.widthMm, f.depthMm * .25]} stroke="#65776e" strokeWidth={1 / scale} listening={false} /></>}
      <Text text={elementName(f)} x={0} y={f.depthMm / 2}
        width={f.widthMm} align="center" fontSize={11 / scale} fill={INK} listening={false} />
    </Group>)}
    {dimensions !== 'none' && dimensions !== 'external' && doc.dimensions.map((d) => <DimensionMark key={d.id} scale={scale} label={d.label}
      layout={{ from: d.from, to: d.to, sourceFrom: d.from, sourceTo: d.to }}
      onSnapMove={(raw) => { const state = store.getState(), result = alignPoints(source, [d.from, d.to].map((p) => ({ x: p.x + raw.x, y: p.y + raw.y })), scale, state.snap, [d.id]); state.setMagneticGuides(result.guides); return { x: raw.x + result.delta.x, y: raw.y + result.delta.y }; }}
      onMove={!readOnly && tool === 'select' ? (delta) => run(() => store.getState().apply(nudgeSpatialEntities(source, [d.id], delta))) : undefined}
      onSelect={tool === 'select' ? () => store.getState().select([d.id]) : undefined} />)}
    {doc.labels.map((label) => <Text key={label.id} {...label} text={label.text} fontSize={14 / scale}
      fill={INK} draggable={!readOnly && tool === 'select'} onDragMove={(e) => e.target.position(snapPointDrag(store, e.target.position(), scale, [label.id]))} onDragEnd={(e) => drag(label.id, label, e)}
      onClick={(e) => choose(rooms.value.find((r) => /patio|terraza/i.test(label.text) && insideRoom(label, r.boundary))?.id ?? label.id, e)} onTap={(e) => choose(rooms.value.find((r) => /patio|terraza/i.test(label.text) && insideRoom(label, r.boundary))?.id ?? label.id, e)} />)}
    {dimensions !== 'none' && rooms.value.map((room) => {
      const p = interiorPoint(room.boundary);
      return <Group key={`area:${room.id}`} x={p.x} y={p.y} listening={false}>
        <Rect x={-45 / scale} y={-12 / scale} width={90 / scale} height={24 / scale} fill={PAPER} cornerRadius={4 / scale} />
        <Text x={-45 / scale} y={-7 / scale} width={90 / scale} align="center"
          text={`${(room.areaMm2 / 1e6).toFixed(2)} m²`} fontSize={13 / scale} fill={INK} />
      </Group>;
    })}
    {!readOnly && !disabled && tool === 'select' && <VertexHandles store={store} source={source} scale={scale}
      selected={selected} rooms={rooms.value} preview={preview} onPreview={setPreview} />}
    {!readOnly && !disabled && tool === 'select' && doc.walls.filter((w) => selected.includes(w.id) && w.curveHeightMm).map((wall) =>
      <CurveHandle key={wall.id} doc={doc} wall={wall} store={store} scale={scale} onPreview={setObjectPreview} />)}
    {!readOnly && !disabled && tool === 'select' && selected.length === 1 && <ObjectTransformControls
      key={selected[0]} store={store} source={source} id={selected[0]!} scale={scale} onPreview={setObjectPreview} />}
    {!readOnly && !disabled && tool === 'select' && selected.length === 1 && <OpeningResizeControls
      key={`opening:${selected[0]}`} store={store} source={source} preview={doc} id={selected[0]!} scale={scale} onPreview={setObjectPreview} />}
    <WalkthroughLayer store={store} scale={scale} disabled={disabled} />
    {showLighting && <><LightStripLayer store={store} scale={scale} disabled={disabled} /><CeilingLightingLayer store={store} scale={scale} disabled={disabled} /></>}
    <CommentMarkers doc={doc} store={store} scale={scale} />
  </Group>;
}
