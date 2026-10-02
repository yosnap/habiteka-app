'use client';
import { planObjects, isBoundary, isLegacyBoundary, boundaryDefaults } from '@/lib/editor-document/boundary-types';

import { addBoundaryGate, projectBoundary } from '@/lib/editor-document/boundary-commands';
import { snapPointDrag, snapSpatialDrag } from './magnetic-drag';
import { addLinearBoundary, isBoundaryKind } from '@/lib/editor-document/linear-boundary';
import { addKitchenRun, addKitchenSlot } from '@/lib/editor-document/kitchen-run-commands';
import { kitchenSlotDrop } from '@/lib/editor-document/kitchen-slot-drop';
import { orientKitchenRun, snapToWallFace } from '@/lib/editor-document/kitchen-run-placement';
import { addOutdoorArea, addOutdoorEdge } from '@/lib/editor-document/outdoor-area';
import { addFreeStrip, setLightStripPath } from '@/lib/editor-document/light-strip-commands';
import { MAX_STRIP_POINTS } from '@/lib/editor-document/light-strip-types';
import { putWalkthrough, waypoint } from '@/lib/editor-document/walkthrough';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Line, Circle, Group, Rect, Text, Image as KonvaImage } from 'react-konva';
import { Hand, Maximize, ZoomIn, ZoomOut } from 'lucide-react';
import { shortcutHint } from '@/canvas/editor-v2/editor-shortcuts';
import { fittedView, resizedView, zoomedView } from '@/canvas/editor-v2/view-math';
import type Konva from 'konva';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { resolveWallSplitPoint } from '@/canvas/editor-v2/store';
import type { Point } from '@/lib/editor-document/schema';
import { addWallPath, editDocument, newId } from '@/canvas/editor-v2/editing-operations';
import { distance } from '@/lib/editor-document/geometry';
import { DocumentLayer } from './document-layer';
import { LightZoneDrawLayer } from './light-zone-draw-layer';
import { useLightZoneTool } from './use-light-zone-tool';
import { DimensionMark } from './dimension-mark';
import { snapWallPoint } from '@/canvas/editor-v2/snap-candidates';
import { clickGuardWallDraw, clickWallDraw, idleWallDraw, moveWallDraw } from '@/canvas/editor-v2/wall-draw-machine';
import styles from './editor.module.css';
import { CanvasSelectionMenu } from './canvas-selection-menu';
import { drawingDimension, rectangleDimensions } from '@/canvas/editor-v2/drawing-dimensions';
import { selectEntitiesInRectangle } from '@/canvas/editor-v2/marquee-selection';
import { snapObject } from '@/canvas/editor-v2/spatial-placement';
import { objectCenter } from '@/lib/editor-document/spatial-properties';
import type { DimensionVisibility } from './visibility-menu';
import { elementName } from '@/lib/editor-document/element-classification';
import { isRampLanding } from '@/lib/editor-document/ramp-kind';
import type { SpatialClipboardItem } from '@/canvas/editor-v2/spatial-clipboard';
import type { PlanReference } from '@/lib/editor-document/plan-reference';

type Marquee = { from: Point; to: Point; baseSelection: string[]; mode: 'replace' | 'add' | 'subtract' };

/** Nombre corto del elemento pendiente de colocar (copia o alta de catálogo). */
function placementLabel(item: SpatialClipboardItem): string {
  if ('stepCount' in item) return 'Escalera';
  if ('riseMm' in item) return isRampLanding(item) ? 'Descansillo' : 'Rampa';
  if (!('kind' in item)) return 'Columna';
  return elementName(item);
}

export function CanvasView({ store, onCenter, active = true, fitOnMount = false, presentation = 'technical', dimensions = 'all', showFurniture = true, showWalls = true, showLighting = true, reference }: { store: EditorStore; onCenter: (p: Point) => void; active?: boolean; fitOnMount?: boolean; presentation?: 'technical' | 'visual'; dimensions?: DimensionVisibility; showFurniture?: boolean; showWalls?: boolean; showLighting?: boolean; reference?: PlanReference | null }) {
  const doc = useStore(store, (s) => s.document), tool = useStore(store, (s) => s.tool);
  const magneticGuides = useStore(store, (s) => s.magneticGuides);
  useEffect(() => {
    const clear = () => store.getState().setMagneticGuides([]);
    window.addEventListener("mouseup", clear); window.addEventListener("pointerup", clear);
    return () => { window.removeEventListener("mouseup", clear); window.removeEventListener("pointerup", clear); };
  }, [store]);
  const readOnly = useStore(store, (s) => s.readOnly);
  const snapEnabled = useStore(store, (s) => s.snap);
  const pendingSplitWallId = useStore(store, (s) => s.pendingSplitWallId);
  const pendingSpatial = useStore(store, (s) => s.pendingSpatial);
  const zoneTool = useLightZoneTool(store);
  const [wallDraw, setWallDraw] = useState(idleWallDraw);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState({ x: 80, y: 80, scale: .08 });
  const initialFitDone = useRef(false);
  useEffect(() => {
    if (!fitOnMount || initialFitDone.current || size.width <= 100 || size.height <= 100) return;
    const frame = requestAnimationFrame(() => {
      if (initialFitDone.current) return;
      initialFitDone.current = true;
      if (!store.getState().focusPoint) setView(fittedView(doc, size));
    });
    return () => cancelAnimationFrame(frame);
  }, [fitOnMount, doc, size, store]);
  const [loadedReference, setLoadedReference] = useState<{ url: string; image: HTMLImageElement } | null>(null);
  const [referenceVisible, setReferenceVisible] = useState(Boolean(reference));
  const [referenceOpacity, setReferenceOpacity] = useState(0.75);
  useEffect(() => {
    if (!reference?.imageUrl) return;
    let active = true;
    const image = new window.Image();
    image.onload = () => { if (active) setLoadedReference({ url: reference.imageUrl, image }); };
    image.onerror = () => { if (active) setLoadedReference(null); };
    image.src = reference.imageUrl;
    return () => { active = false; };
  }, [reference?.imageUrl]);
  const referenceImage = loadedReference && loadedReference.url === reference?.imageUrl
    ? loadedReference.image : null;
  const showReference = Boolean(reference && referenceVisible && referenceImage);
  // Centrar la vista a petición (buscador del inspector) sin cambiar la escala; se atiende una sola vez por petición.
  const focusPoint = useStore(store, (s) => s.focusPoint);
  const [handledFocus, setHandledFocus] = useState(focusPoint);
  if (focusPoint !== handledFocus) {
    setHandledFocus(focusPoint);
    if (active && focusPoint && size.width > 100 && size.height > 100) setView((current) => ({ ...current, x: size.width / 2 - focusPoint.point.x * current.scale, y: size.height / 2 - focusPoint.point.y * current.scale }));
  }
  const pan = useStore(store, (s) => s.pan), setPan = (next: boolean) => store.getState().setPan(next);
  const [gesture, setGesture] = useState<{ point: Point; tool: string } | null>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [chain, setChain] = useState<Point[]>([]);
  const continuous = tool === 'wall' || tool === 'guard-wall' || tool === 'patio' || tool === 'kitchen' || tool === 'light-strip' || isBoundaryKind(tool);
  // Tira libre en curso: el primer tramo la crea y los siguientes alargan su recorrido.
  const [stripId, setStripId] = useState<string | null>(null);
  const start = continuous ? chain.at(-1) ?? null : gesture?.tool === tool ? gesture.point : null;
  const [pointer, setPointer] = useState<Point | null>(null), [generation, setGeneration] = useState(0);
  const stage = useRef<Konva.Stage>(null);
  useEffect(() => {
    if (active && size.width > 10 && size.height > 10)
      onCenter({ x: (size.width / 2 - view.x) / view.scale, y: (size.height / 2 - view.y) / view.scale });
  }, [active, size, view, onCenter]);
  // External tool/permission transitions and undo invalidate only the uncommitted preview.
  useEffect(() => store.subscribe((next, previous) => {
    if (next.tool === 'split-wall' && previous.tool !== next.tool) stage.current?.container().parentElement?.focus();
    if (next.tool !== previous.tool || next.readOnly !== previous.readOnly || next.future.length > previous.future.length || next.document.activeLevelId !== previous.document.activeLevelId) {
      setWallDraw(idleWallDraw()); setChain([]); setGesture(null); setPointer(null); setMarquee(null); setStripId(null);
    }
  }), [store]);
  useEffect(() => {
    const element = stage.current?.container();
    if (element) element.style.cursor = !readOnly && ['valla-madera', 'cerca-metal', 'seto', 'kitchen', 'light-strip', 'light-zone', 'wall', 'guard-wall', 'rectangle', 'patio', 'measure', 'walkthrough'].includes(tool)
      ? 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2732%27 height=%2732%27 viewBox=%270 0 32 32%27%3E%3Cpath fill=%27%23087f75%27 d=%27m5 27 3-8L23 4l5 5L13 24z%27/%3E%3Cpath fill=%27white%27 d=%27m10 20 2 2-4 3z%27/%3E%3C/svg%3E") 4 28, crosshair'
      : '';
  }, [tool, readOnly]);
  // ResizeObserver is a real external subscription; callback-ref cleanup releases it on unmount.
  const previousSize = useRef<{ width: number; height: number } | null>(null);
  const container = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.width <= 0 || entry.contentRect.height <= 0) return;
      const next = { width: entry.contentRect.width, height: entry.contentRect.height };
      const previous = previousSize.current;
      if (previous) setView((current) => resizedView(current, previous, next));
      previousSize.current = next;
      setSize(next);
    });
    observer.observe(node); return () => observer.disconnect();
  }, []);
  const updateView = (next: typeof view) => {
    setView(next); onCenter({ x: (size.width / 2 - next.x) / next.scale, y: (size.height / 2 - next.y) / next.scale });
  };
  const zoom = (factor: number, point?: Point) => updateView(zoomedView(view, factor, size, point));
  const fit = () => updateView(fittedView(doc, size));
  // Encuadre y zoom pedidos desde el teclado o el buscador: se atienden una sola vez por petición.
  const viewRequest = useStore(store, (s) => s.viewRequest);
  const [handledRequest, setHandledRequest] = useState(viewRequest);
  if (viewRequest !== handledRequest) {
    setHandledRequest(viewRequest);
    if (viewRequest && active) setView((current) => viewRequest.kind === 'fit' ? fittedView(doc, size) : zoomedView(current, viewRequest.kind === 'zoom-in' ? 1.25 : .8, size));
  }
  const point = () => {
    const p = stage.current?.getRelativePointerPosition();
    if (tool === 'split-wall') return p ?? null;
    if (p && continuous && chain.length > 2 && distance(p, chain[0]!) < 12 / view.scale) {
      store.getState().setMagneticGuides([{ from: start!, to: chain[0]! }]); return chain[0]!;
    }
    if (p && (tool === 'wall' || tool === 'guard-wall')) {
      const result = snapWallPoint(store.getState().document, p, view.scale, store.getState().snap, wallDraw.anchor ?? undefined);
      store.getState().setMagneticGuides(result.guides ?? (result.guide ? [result.guide] : []));
      return result.point;
    }
    // La cocina se pega por la trasera a la cara de muro más cercana; lejos de un muro, imanes normales.
    if (p && tool === 'kitchen') {
      const face = snapToWallFace(store.getState().document, p, Math.max(150, 24 / view.scale));
      if (face) { store.getState().setMagneticGuides([]); return face.point; }
    }
    return p ? (tool === 'select' ? p : snapPointDrag(store, p, view.scale)) : null;
  };
  const cancel = () => { stage.current?.stopDrag(); store.getState().cancelWallSplit(); store.getState().cancelPendingSpatial(); setWallDraw(idleWallDraw()); setChain([]); setGesture(null); setPointer(null); setMarquee(null); setStripId(null); setGeneration((n) => n + 1); store.getState().setTool('select'); };
  const clickChain = () => {
    const p = point(); if (!p) return;
    if (!start) { setChain([p]); setPointer(p); setWallDraw({ anchor: p, preview: p }); return; }
    if (distance(start, p) < 50) return;
    try {
      const state = store.getState();
      let closed = chain.length > 2 && distance(p, chain[0]!) < .01;
      if (tool === 'wall' || tool === 'guard-wall') {
        const extension = tool === 'wall' ? snapWallPoint(state.document, p, view.scale, state.snap, start).extension : undefined;
        const result = tool === 'wall' ? clickWallDraw({ anchor: start, preview: p }, p, state.document, extension)
          : clickGuardWallDraw({ anchor: start, preview: p }, p, state.document);
        if (!result.document) return;
        state.apply(result.document);
        if (tool === 'wall' && !result.state.anchor) closed = true;
      } else if (isBoundaryKind(tool)) state.apply(addLinearBoundary(state.document, tool, start, p));
      else if (tool === 'kitchen') state.apply(addKitchenRun(state.document, ...orientKitchenRun(state.document, start, p, 400)));
      else if (tool === 'patio') state.apply(addOutdoorEdge(state.document, start, p));
      else if (tool === 'light-strip') {
        if (stripId) state.apply(setLightStripPath(state.document, stripId, [...chain, p]));
        else {
          state.apply(addFreeStrip(state.document, [start, p]));
          setStripId(store.getState().document.lightStrips!.at(-1)!.id);
        }
        closed = chain.length + 1 >= MAX_STRIP_POINTS;
      }
      if (closed) { setChain([]); setWallDraw(idleWallDraw()); setPointer(null); state.setTool('select'); }
      else { setChain([...chain, p]); setPointer(p); setWallDraw({ anchor: p, preview: p }); }
    } catch (error) { store.getState().setError(error instanceof Error ? error.message : 'Trazo inválido'); }
  };
  const finish = () => {
    const p = point();
    if (!p || !start || distance(start, p) < 50) { setGesture(null); setPointer(null); setWallDraw(idleWallDraw()); return; }
    try {
      const state = store.getState();
      if (tool === 'wall' || tool === 'guard-wall') {
        const extension = tool === 'wall' ? snapWallPoint(state.document, p, view.scale, state.snap, start).extension : undefined;
        const draw = { anchor: start, preview: p };
        const result = tool === 'wall' ? clickWallDraw(draw, p, state.document, extension) : clickGuardWallDraw(draw, p, state.document);
        if (result.document) state.apply(result.document);
      }
      if (isBoundaryKind(tool)) state.apply(addLinearBoundary(state.document, tool, start, p));
      if (tool === 'patio') state.apply(addOutdoorArea(state.document, start, p));
      if (tool === 'rectangle') state.apply(addWallPath(state.document,
        [start, { x: p.x, y: start.y }, p, { x: start.x, y: p.y }], true));
      if (tool === 'measure') state.apply(editDocument(state.document,
        (next) => next.dimensions.push({ id: newId(), from: start, to: p })));
      state.setTool('select');
    } catch (error) { store.getState().setError(error instanceof Error ? error.message : 'Trazo inválido'); }
    setGesture(null); setPointer(null); setWallDraw(idleWallDraw());
  };
  const finishMarquee = () => {
    if (!marquee) return;
    const p = point() ?? marquee.to, state = store.getState();
    if (distance(marquee.from, p) < 8 / view.scale) {
      if (marquee.mode === 'replace') state.select([]);
    } else {
      const ids = selectEntitiesInRectangle(state.document, marquee.from, p);
      const selection = marquee.mode === 'replace' ? ids : marquee.mode === 'add'
        ? [...new Set([...marquee.baseSelection, ...ids])]
        : marquee.baseSelection.filter((id) => !ids.includes(id));
      state.select(selection);
    }
    setMarquee(null);
  };
  const grid = useMemo(() => {
    if (presentation === 'visual') return [];
    const step = view.scale < .04 ? 1000 : 500, lines: number[][] = [];
    const left = -view.x / view.scale, top = -view.y / view.scale;
    for (let x = Math.floor(left / step) * step; x < left + size.width / view.scale; x += step)
      lines.push([x, top, x, top + size.height / view.scale]);
    for (let y = Math.floor(top / step) * step; y < top + size.height / view.scale; y += step)
      lines.push([left, y, left + size.width / view.scale, y]);
    return lines;
  }, [presentation, size, view]);
  const drawing = !readOnly && ['valla-madera', 'cerca-metal', 'seto', 'kitchen', 'light-strip', 'wall', 'guard-wall', 'rectangle', 'patio', 'measure'].includes(tool);
  const wallPreview = (tool === 'wall' || tool === 'guard-wall') && !readOnly ? wallDraw : idleWallDraw();
  const wallLength = wallPreview.anchor && wallPreview.preview ? distance(wallPreview.anchor, wallPreview.preview) : 0;
  const draftDimension = wallPreview.anchor && wallPreview.preview ? drawingDimension(wallPreview.anchor, wallPreview.preview, view.scale) : null;
  const wallExtension = wallPreview.anchor && wallPreview.preview
    && tool === 'wall' ? snapWallPoint(doc, wallPreview.preview, view.scale, snapEnabled, wallPreview.anchor).extension : undefined;
  const wallMagnet = wallPreview.anchor && wallPreview.preview
    ? snapWallPoint(doc, wallPreview.preview, view.scale, snapEnabled, wallPreview.anchor) : undefined;
  const boundaryDimension = start && pointer && (isBoundaryKind(tool) || tool === 'kitchen' || tool === 'patio' || tool === 'light-strip') ? drawingDimension(start, pointer, view.scale) : null;
  // Cota en vivo del tramo en curso de la zona, igual que en el resto de trazos.
  const zoneAnchor = zoneTool.draft.vertices.at(-1) ?? null;
  const zoneDimension = zoneTool.active && zoneAnchor && zoneTool.cursor ? drawingDimension(zoneAnchor, zoneTool.cursor, view.scale) : null;
  const splitting = tool === 'split-wall' && !readOnly;
  const placingSpatial = tool === 'place-object' && !readOnly && !!pendingSpatial;
  const spatialPreview = useMemo(() => {
    if (!pendingSpatial || !pointer) return null;
    const origin = objectCenter({ ...pendingSpatial, x: 0, y: 0 });
    return snapObject(doc, { ...pendingSpatial, x: pointer.x - origin.x, y: pointer.y - origin.y }, view.scale, snapEnabled, { preserveRotation: true });
  }, [doc, pendingSpatial, pointer, snapEnabled, view.scale]);
  const splitPreview = splitting && pendingSplitWallId && pointer ? resolveWallSplitPoint(doc, pendingSplitWallId, pointer, view.scale) : null;
  const splitNormal = splitPreview ? { x: (splitPreview.to.y - splitPreview.from.y) / distance(splitPreview.from, splitPreview.to) * 40 / view.scale,
    y: -(splitPreview.to.x - splitPreview.from.x) / distance(splitPreview.from, splitPreview.to) * 40 / view.scale } : { x: 0, y: 0 };
  return <div className={styles.canvas} data-presentation={presentation} ref={container} aria-label="Lienzo del plano" tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === 'Escape') {
        if (pendingSpatial) { e.preventDefault(); e.stopPropagation(); store.getState().cancelPendingSpatial(); return; }
        cancel(); return;
      }
      if (tool === 'walkthrough' && e.key === 'Enter') { e.preventDefault(); store.getState().setTool('select'); return; }
      if (!zoneTool.active) return;
      if (e.key === 'Enter') { e.preventDefault(); zoneTool.close(); }
      else if (e.key === 'Backspace') { e.preventDefault(); zoneTool.undoVertex(); }
    }} onPointerCancel={cancel}>
    {size.width > 0 && size.height > 0 && <Stage ref={stage} width={size.width} height={size.height} x={view.x} y={view.y}
      scaleX={view.scale} scaleY={view.scale} draggable={pan}
      onDragEnd={(e) => { if (e.target === stage.current) updateView({ ...view, ...e.target.position() }); }}
      onWheel={(e) => { e.evt.preventDefault(); zoom(e.evt.deltaY > 0 ? .9 : 1.1, stage.current?.getPointerPosition() ?? undefined); }}
      onPointerDown={(e) => {
        stage.current?.container().parentElement?.focus();
        if (pan) return;
        if (tool === 'walkthrough' && !readOnly) {
          if (e.evt.button !== undefined && e.evt.button !== 0) return;
          const p = point(), state = store.getState();
          const route = state.document.walkthroughs?.find((path) => path.id === state.walkthroughId);
          if (p && route && e.target.getClassName() !== 'Circle') {
            try { state.apply(putWalkthrough(state.document, { ...route, waypoints: [...route.waypoints, waypoint(p)] })); }
            catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo añadir el punto'); }
          }
          return;
        }
        if (zoneTool.active) {
          if (e.evt.button !== undefined && e.evt.button !== 0) return;
          const p = point(); if (p) zoneTool.pointerDown(p);
          return;
        }
        if (tool === 'door' && !readOnly && !store.getState().pendingOpening) {
          const p = stage.current?.getRelativePointerPosition();
          if (p) {
            const target = planObjects(doc).filter((b) => isBoundary(b) || isLegacyBoundary(b)).map((item) => {
              const b = isBoundary(item) ? item : boundaryDefaults(item), x = projectBoundary(b, p), r = b.rotation * Math.PI / 180;
              const gap = Math.abs(-(p.x - b.x) * Math.sin(r) + (p.y - b.y) * Math.cos(r) - b.depthMm / 2);
              return { b, x, gap };
            }).filter(({ b, x, gap }) => x >= 0 && x <= b.widthMm && gap <= b.depthMm / 2 + 10 / view.scale).sort((a, b) => a.gap - b.gap)[0];
            if (target) {
              try { store.getState().apply(addBoundaryGate(doc, target.b.id, target.x)); store.getState().setTool('select'); store.getState().select([target.b.id]); }
              catch (error) { store.getState().setError(error instanceof Error ? error.message : 'No se pudo colocar la puerta'); }
              return;
            }
          }
        }
        if (placingSpatial) {
          if (e.evt.button !== undefined && e.evt.button !== 0) return;
          const raw = stage.current?.getRelativePointerPosition();
          if (!raw || !pendingSpatial) return;
          // Un aparato de cocina soltado sobre un tramo se encaja en él como hueco.
          const drop = 'kind' in pendingSpatial && !('stepCount' in pendingSpatial) ? kitchenSlotDrop(doc, pendingSpatial, raw) : null;
          if (drop) {
            try { store.getState().apply(addKitchenSlot(doc, drop.runId, drop.kind, drop.positionMm)); store.getState().cancelPendingSpatial(); store.getState().select([drop.runId]); }
            catch (error) { store.getState().setError(error instanceof Error ? error.message : 'No se pudo encajar el aparato'); }
            setPointer(null); return;
          }
          const origin = objectCenter({ ...pendingSpatial, x: 0, y: 0 });
          const item = snapObject(doc, { ...pendingSpatial, x: raw.x - origin.x, y: raw.y - origin.y }, view.scale, snapEnabled, { preserveRotation: true });
          store.getState().placePendingSpatial(item); setPointer(null); return;
        }
        if (splitting) {
          if (e.evt.button !== undefined && e.evt.button !== 0) return;
          const p = point(); if (p) store.getState().commitWallSplit(p, view.scale); return;
        }
        if (tool === 'select' && e.target === stage.current) {
          const p = point(); if (!p) return;
          const mode = e.evt.altKey ? 'subtract' : e.evt.metaKey || e.evt.ctrlKey || e.evt.shiftKey ? 'add' : 'replace';
          setMarquee({ from: p, to: p, baseSelection: store.getState().selection, mode });
          return;
        }
        if (continuous && drawing) {
          if (e.evt.button !== undefined && e.evt.button !== 0) return;
          clickChain(); return;
        }
        if (drawing) {
          if (e.evt.button !== undefined && e.evt.button !== 0) return;
          const p = point();
          if (p) {
            setGesture({ point: p, tool }); setPointer(p);
            if (tool === 'wall' || tool === 'guard-wall') setWallDraw({ anchor: p, preview: p });
          }
        }
      }} onPointerMove={() => {
        if (!pan && zoneTool.active) { const p = point(); if (p) zoneTool.pointerMove(p); return; }
        if (!pan && placingSpatial) { const raw = stage.current?.getRelativePointerPosition(); setPointer(raw ?? null); if (raw && pendingSpatial) { const origin = objectCenter({ ...pendingSpatial, x: 0, y: 0 }); snapSpatialDrag(store, { ...pendingSpatial, x: raw.x - origin.x, y: raw.y - origin.y }, view.scale); } return; }
        if (!pan && splitting) { setPointer(point()); return; }
        if (!pan && marquee) { const p = point(); if (p) setMarquee((current) => current ? { ...current, to: p } : null); return; }
        if (pan || !drawing) return;
        const p = point();
        if (p && (tool === 'wall' || tool === 'guard-wall')) setWallDraw((current) => moveWallDraw(current, p));
        else if (start) setPointer(p);
      }} onPointerUp={() => { if (!pan && zoneTool.active) zoneTool.pointerUp(); else if (!pan && marquee) finishMarquee(); else if (!pan && drawing && !continuous) finish(); }}
      onDblClick={() => { if (!pan && zoneTool.active) zoneTool.close(); }} >

      {showReference && reference && referenceImage && <Layer listening={false}>
        <KonvaImage image={referenceImage} x={reference.xMm ?? 0} y={reference.yMm ?? 0} width={reference.widthMm} height={reference.heightMm}
          opacity={referenceOpacity} listening={false} />
      </Layer>}
      {!showReference && <Layer listening={false}>{grid.map((points, i) => <Line key={i} points={points} stroke="#e0e7e4" strokeWidth={1 / view.scale} />)}</Layer>}
      <Layer key={`dimension-arrows-v1:${generation}:${tool}:${doc.activeLevelId}:${dimensions}:${showFurniture}:${showWalls}:${showLighting}:${showReference}:${presentation}`} listening={!pan && active}><DocumentLayer store={store} scale={view.scale} disabled={pan || !active} dimensions={dimensions} presentation={presentation} showFurniture={showFurniture} showWalls={showWalls} showLighting={showLighting} referenceVisible={showReference} /></Layer>
      {/* Una sola capa para todas las superposiciones no interactivas: Konva penaliza más de 5 capas por escenario. */}
      <Layer listening={false}>
      <>{start && pointer && <Line points={(tool === 'rectangle')
        ? [start.x, start.y, pointer.x, start.y, pointer.x, pointer.y, start.x, pointer.y, start.x, start.y]
        : continuous ? [...chain.flatMap((p) => [p.x, p.y]), pointer.x, pointer.y] : [start.x, start.y, pointer.x, pointer.y]} stroke="#087f75" strokeWidth={2 / view.scale} dash={[8 / view.scale, 4 / view.scale]} />}</>
      <>{wallPreview.anchor && wallPreview.preview && wallLength >= 50 && <>
        {wallExtension && <>
          <Line points={[wallExtension.from.x, wallExtension.from.y, wallExtension.point.x, wallExtension.point.y]}
            stroke="#087f75" strokeWidth={doc.walls.find((w) => w.id === wallExtension.wallId)?.thicknessMm ?? 150} opacity={.45} />
          <Circle x={wallExtension.point.x} y={wallExtension.point.y} radius={6 / view.scale}
            fill="#087f75" stroke="white" strokeWidth={2 / view.scale} />
        </>}
        <Line points={[wallPreview.anchor.x, wallPreview.anchor.y, wallPreview.preview.x, wallPreview.preview.y]}
          stroke="#087f75" strokeWidth={150} opacity={.45} />
        {wallMagnet && wallMagnet.kind !== 'free' && <><Circle x={wallMagnet.point.x} y={wallMagnet.point.y} radius={11 / view.scale}
          stroke="#00a693" strokeWidth={3 / view.scale} fill="rgba(0,166,147,.12)" />
        {wallMagnet.kind === 'landing' && wallMagnet.guide && <Line points={[wallMagnet.guide.from.x, wallMagnet.guide.from.y, wallMagnet.guide.to.x, wallMagnet.guide.to.y]}
          stroke="#00a693" strokeWidth={3 / view.scale} dash={[10 / view.scale, 6 / view.scale]} />}
        {wallMagnet.kind === 'orthogonal' && <Line points={[wallPreview.anchor.x, wallPreview.anchor.y, wallMagnet.point.x, wallMagnet.point.y]}
            stroke="#00a693" strokeWidth={2 / view.scale} dash={[8 / view.scale, 5 / view.scale]} />}</>}
        {draftDimension && <DimensionMark scale={view.scale} layout={draftDimension} />}
      </>}</>
      <>{boundaryDimension && <DimensionMark layout={boundaryDimension} scale={view.scale} />}</>
      <>{zoneTool.active && <LightZoneDrawLayer draft={zoneTool.draft} cursor={zoneTool.cursor}
        hovered={zoneTool.hovered} rectangle={zoneTool.rectangle} scale={view.scale} />}</>
      <>{zoneDimension && <DimensionMark layout={zoneDimension} scale={view.scale} />}</>
      <>{start && pointer && (tool === 'rectangle') && rectangleDimensions(start, pointer, view.scale)
        .map((layout, index) => <DimensionMark key={index} layout={layout} scale={view.scale} />)}</>
      <>{marquee && <Rect x={Math.min(marquee.from.x, marquee.to.x)} y={Math.min(marquee.from.y, marquee.to.y)}
        width={Math.abs(marquee.to.x - marquee.from.x)} height={Math.abs(marquee.to.y - marquee.from.y)}
        fill="#087f7520" stroke="#087f75" strokeWidth={2 / view.scale} dash={[8 / view.scale, 4 / view.scale]} />}</>
      <>{splitPreview && <>
        <Circle x={splitPreview.point.x} y={splitPreview.point.y} radius={7 / view.scale}
          fill={splitPreview.valid ? '#087f75' : '#b83232'} stroke="white" strokeWidth={2 / view.scale} />
        <DimensionMark scale={view.scale} layout={{ sourceFrom: splitPreview.from, sourceTo: splitPreview.point,
          from: { x: splitPreview.from.x + splitNormal.x, y: splitPreview.from.y + splitNormal.y },
          to: { x: splitPreview.point.x + splitNormal.x, y: splitPreview.point.y + splitNormal.y } }} />
      </>}</>
      <>{spatialPreview && <Group x={spatialPreview.x} y={spatialPreview.y} rotation={spatialPreview.rotation} opacity={.72}>
        <Rect width={spatialPreview.widthMm} height={spatialPreview.depthMm} fill="#00a69355" stroke="#087f75" strokeWidth={2 / view.scale} />
        <Text width={spatialPreview.widthMm} y={spatialPreview.depthMm / 2 - 7 / view.scale} align="center" fill="#087f75" fontSize={12 / view.scale}
          text={`${placementLabel(spatialPreview)} · clic para colocar · Esc cancela`} />
      </Group>}</>
      <>{magneticGuides.map((g, i) => <Line key={i} points={[g.from.x, g.from.y, g.to.x, g.to.y]} stroke="#087f75" strokeWidth={1.5 / view.scale} dash={[6 / view.scale, 4 / view.scale]} />)}</>
      </Layer>
    </Stage>}
    {!pan && wallExtension && <div role="status" style={{ position: 'absolute', top: 16, left: 16, padding: 8, background: '#fff', pointerEvents: 'none' }}>
      Cerrar habitación · prolongar pared existente sin añadir un tramo
    </div>}
    {!pan && !wallExtension && wallMagnet && wallMagnet.kind !== 'free' && <div role="status" style={{ position: 'absolute', top: 16, left: 16, padding: 8, background: '#fff', pointerEvents: 'none' }}>
      {wallMagnet.kind === 'orthogonal' ? 'Imán activo · pared recta' : wallMagnet.kind === 'landing'
        ? 'Imán activo · borde del descansillo' : 'Imán activo · unir al vértice'}
    </div>}
    {!pan && (tool === 'wall' || tool === 'guard-wall') && !wallExtension && (!wallMagnet || wallMagnet.kind === 'free') && <div role="status" style={{ position: 'absolute', top: 16, left: 16, padding: 8, background: '#fff', pointerEvents: 'none' }}>
      {wallPreview.anchor ? 'Clic para añadir tramo · cierra el contorno o pulsa Esc' : 'Clic para comenzar · Esc para salir'}
    </div>}
    {!pan && continuous && tool !== 'wall' && tool !== 'guard-wall' && <div role="status" style={{ position: 'absolute', top: 16, left: 16, padding: 8, background: '#fff', pointerEvents: 'none' }}>
      {tool === 'light-strip' ? (start ? 'Clic para alargar la tira · Esc para terminar' : 'Clic dentro de una estancia para empezar la tira · Esc para salir')
        : tool === 'kitchen' ? (start ? 'Clic para cerrar el tramo · Esc para salir' : 'Clic junto a un muro para comenzar · el mueble se pega a su cara') : start ? 'Clic para añadir tramo · cierra el contorno o pulsa Esc' : 'Clic para comenzar · Esc para salir'}
    </div>}
    {!pan && zoneTool.active && <div role="status" style={{ position: 'absolute', top: 16, left: 16, padding: 8, background: '#fff', pointerEvents: 'none' }}>
      {zoneTool.draft.parts.length ? `${zoneTool.draft.parts.length} partes marcadas · ${zoneTool.hint}` : zoneTool.hint}
    </div>}
    {!pan && splitting && <div role="status" style={{ position: 'absolute', top: 16, left: 16, padding: 8, background: '#fff', pointerEvents: 'none' }}>
      {splitPreview?.reason ?? 'Haz clic sobre la pared para añadir una esquina · Esc para cancelar'}
    </div>}
    {placingSpatial && <div role="status" style={{ position: 'absolute', top: 16, left: 16, padding: 8, background: '#fff', pointerEvents: 'none' }}>
      {pan ? 'Mano activa · desactívala para colocar el objeto' : 'Mueve el objeto y haz clic para colocarlo · Esc para cancelar'}
    </div>}
    {pan && !placingSpatial && <div role="status" style={{ position: 'absolute', top: 16, left: 16, padding: 8, background: '#fff', pointerEvents: 'none' }}>
      Mano activa · arrastra para desplazar la vista · Espacio para volver
    </div>}
    {!pan && tool === 'select' && <div role="status" style={{ position: 'absolute', top: 16, left: 16, padding: 8, background: '#fff', pointerEvents: 'none' }}>
      {readOnly ? 'Diseño aprobado · usa el borrador para hacer cambios' : presentation === 'visual' ? 'Añade desde Amueblar o Construir · arrastra para mover · selecciona para editar' : 'Arrastra para seleccionar · Mayús/⌘/Ctrl suma · ⌥ resta · Flechas: 1 cm · Mayús+flechas: 10 cm · Supr elimina'}
    </div>}
    {!pan && <CanvasSelectionMenu store={store} view={view} size={size} />}
    {!doc.walls.length && !planObjects(doc).length && !doc.stairs?.length && !doc.ramps?.length && <div className={styles.empty}>
      <strong>Tu espacio empieza aquí</strong><span>Traza un muro, dibuja una habitación o importa tu plano.</span>
    </div>}
    <div className={styles.navigation} aria-label="Navegación del lienzo">
      {reference && <>
        <button type="button" aria-pressed={showReference} onClick={() => setReferenceVisible((value) => !value)}>
          {showReference ? 'Ocultar original' : 'Mostrar original'}
        </button>
        {showReference && <input type="range" min={20} max={100} value={Math.round(referenceOpacity * 100)}
          aria-label="Opacidad del plano original" onChange={(event) => setReferenceOpacity(Number(event.target.value) / 100)} />}
      </>}
      <button onClick={() => zoom(.8)} aria-label="Alejar" data-tooltip={shortcutHint('Alejar', 'zoomOut')}><ZoomOut size={18} aria-hidden="true" /></button>
      <span>{Math.round(view.scale * 1000)}%</span>
      <button onClick={() => zoom(1.25)} aria-label="Acercar" data-tooltip={shortcutHint('Acercar', 'zoomIn')}><ZoomIn size={18} aria-hidden="true" /></button>
      <button onClick={fit} aria-label="Encuadrar" data-tooltip={shortcutHint('Encuadrar', 'fit')}><Maximize size={18} aria-hidden="true" /></button>
      <button aria-pressed={pan} aria-label="Mano" data-tooltip={shortcutHint(pan ? 'Salir de mano' : 'Mano', 'pan')} onClick={() => setPan(!pan)}><Hand size={18} aria-hidden="true" /></button>
      {(start || wallPreview.anchor) && <button onClick={cancel}>{wallPreview.anchor ? 'Finalizar paredes' : 'Cancelar trazo'}</button>}
      {splitting && <button onClick={cancel}>Cancelar esquina</button>}
      {zoneTool.active && <>
        <button onClick={() => zoneTool.confirm()} disabled={!zoneTool.canConfirm}>Crear zona</button>
        <button onClick={cancel}>Cancelar zona</button>
      </>}
    </div>
  </div>;
}
