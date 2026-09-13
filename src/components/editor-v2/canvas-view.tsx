'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Line, Circle, Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { resolveWallSplitPoint } from '@/canvas/editor-v2/store';
import type { Point } from '@/lib/editor-document/schema';
import { addWallPath, editDocument, newId, snapPoint } from '@/canvas/editor-v2/editing-operations';
import { distance } from '@/lib/editor-document/geometry';
import { DocumentLayer } from './document-layer';
import { DimensionMark } from './dimension-mark';
import { snapWallPoint } from '@/canvas/editor-v2/snap-candidates';
import { clickGuardWallDraw, clickWallDraw, idleWallDraw, moveWallDraw } from '@/canvas/editor-v2/wall-draw-machine';
import styles from './editor.module.css';
import { CanvasSelectionMenu } from './canvas-selection-menu';
import { drawingDimension, rectangleDimensions } from '@/canvas/editor-v2/drawing-dimensions';
import { selectEntitiesInRectangle } from '@/canvas/editor-v2/marquee-selection';
import { snapObject } from '@/canvas/editor-v2/spatial-placement';
import { objectCenter } from '@/lib/editor-document/spatial-properties';

type Marquee = { from: Point; to: Point; baseSelection: string[]; mode: 'replace' | 'add' | 'subtract' };

export function CanvasView({ store, onCenter, active = true }: { store: EditorStore; onCenter: (p: Point) => void; active?: boolean }) {
  const doc = useStore(store, (s) => s.document), tool = useStore(store, (s) => s.tool);
  const readOnly = useStore(store, (s) => s.readOnly);
  const snapEnabled = useStore(store, (s) => s.snap);
  const pendingSplitWallId = useStore(store, (s) => s.pendingSplitWallId);
  const pendingSpatial = useStore(store, (s) => s.pendingSpatial);
  const [wallDraw, setWallDraw] = useState(idleWallDraw);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [view, setView] = useState({ x: 80, y: 80, scale: .08 });
  const [pan, setPan] = useState(false), [gesture, setGesture] = useState<{ point: Point; tool: string } | null>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const start = gesture?.tool === tool ? gesture.point : null;
  const [pointer, setPointer] = useState<Point | null>(null), [generation, setGeneration] = useState(0);
  const stage = useRef<Konva.Stage>(null);
  useEffect(() => {
    if (size.width > 10 && size.height > 10)
      onCenter({ x: (size.width / 2 - view.x) / view.scale, y: (size.height / 2 - view.y) / view.scale });
  }, [size, view, onCenter]);
  // External tool/permission transitions and undo invalidate only the uncommitted preview.
  useEffect(() => store.subscribe((next, previous) => {
    if (next.tool === 'split-wall' && previous.tool !== next.tool) stage.current?.container().parentElement?.focus();
    if (next.tool !== previous.tool || next.readOnly !== previous.readOnly || next.future.length > previous.future.length || next.document.activeLevelId !== previous.document.activeLevelId) {
      setWallDraw(idleWallDraw()); setGesture(null); setPointer(null); setMarquee(null);
    }
  }), [store]);
  useEffect(() => {
    const element = stage.current?.container();
    if (element) element.style.cursor = tool === 'wall'
      ? 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2732%27 height=%2732%27 viewBox=%270 0 32 32%27%3E%3Cpath fill=%27%23087f75%27 d=%27m5 27 3-8L23 4l5 5L13 24z%27/%3E%3Cpath fill=%27white%27 d=%27m10 20 2 2-4 3z%27/%3E%3C/svg%3E") 4 28, crosshair'
      : '';
  }, [tool]);
  // ResizeObserver is a real external subscription; callback-ref cleanup releases it on unmount.
  const container = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: Math.max(1, entry.contentRect.width), height: Math.max(1, entry.contentRect.height) });
    });
    observer.observe(node); return () => observer.disconnect();
  }, []);
  const updateView = (next: typeof view) => {
    setView(next); onCenter({ x: (size.width / 2 - next.x) / next.scale, y: (size.height / 2 - next.y) / next.scale });
  };
  const zoom = (factor: number, point = { x: size.width / 2, y: size.height / 2 }) => {
    const scale = Math.min(.5, Math.max(.015, view.scale * factor));
    updateView({ scale, x: point.x - (point.x - view.x) / view.scale * scale,
      y: point.y - (point.y - view.y) / view.scale * scale });
  };
  const fit = () => {
    const points = [...doc.vertices, ...[...doc.furniture, ...(doc.stairs ?? []), ...(doc.ramps ?? []), ...(doc.columns ?? [])].flatMap((f) => {
      const angle = f.rotation * Math.PI / 180;
      return [[0, 0], [f.widthMm, 0], [f.widthMm, f.depthMm], [0, f.depthMm]].map(([x, y]) => ({
        x: f.x + x! * Math.cos(angle) - y! * Math.sin(angle),
        y: f.y + x! * Math.sin(angle) + y! * Math.cos(angle),
      }));
    }), ...doc.labels, ...doc.dimensions.flatMap((d) => [d.from, d.to])];
    if (!points.length) { updateView({ x: 80, y: 80, scale: .08 }); return; }
    const minX = Math.min(...points.map((p) => p.x)), minY = Math.min(...points.map((p) => p.y));
    const width = Math.max(1000, Math.max(...points.map((p) => p.x)) - minX);
    const height = Math.max(1000, Math.max(...points.map((p) => p.y)) - minY);
    const thickness = Math.max(0, ...doc.walls.map((w) => w.thicknessMm));
    const scale = Math.max(.001, Math.min(.3, Math.max(40, size.width - 160) / (width + thickness), Math.max(40, size.height - 160) / (height + thickness)));
    updateView({ scale, x: (size.width - width * scale) / 2 - minX * scale,
      y: (size.height - height * scale) / 2 - minY * scale });
  };
  const point = () => {
    const p = stage.current?.getRelativePointerPosition();
    if (tool === 'split-wall') return p ?? null;
    if (p && (tool === 'wall' || tool === 'guard-wall'))
      return snapWallPoint(store.getState().document, p, view.scale, store.getState().snap, wallDraw.anchor ?? undefined).point;
    return p ? snapPoint(store.getState().document, p, store.getState().snap) : null;
  };
  const cancel = () => { stage.current?.stopDrag(); store.getState().cancelWallSplit(); store.getState().cancelPendingSpatial(); setWallDraw(idleWallDraw()); setGesture(null); setPointer(null); setMarquee(null); setGeneration((n) => n + 1); };
  const finish = () => {
    const p = point(); if (!p || !start || distance(start, p) < 50) return;
    try {
      const state = store.getState();
      if (tool === 'rectangle') state.apply(addWallPath(state.document,
        [start, { x: p.x, y: start.y }, p, { x: start.x, y: p.y }], true));
      if (tool === 'measure') state.apply(editDocument(state.document,
        (next) => next.dimensions.push({ id: newId(), from: start, to: p })));
    } catch (error) { store.getState().setError(error instanceof Error ? error.message : 'Trazo inválido'); }
    setGesture(null); setPointer(null);
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
    const step = view.scale < .04 ? 1000 : 500, lines: number[][] = [];
    const left = -view.x / view.scale, top = -view.y / view.scale;
    for (let x = Math.floor(left / step) * step; x < left + size.width / view.scale; x += step)
      lines.push([x, top, x, top + size.height / view.scale]);
    for (let y = Math.floor(top / step) * step; y < top + size.height / view.scale; y += step)
      lines.push([left, y, left + size.width / view.scale, y]);
    return lines;
  }, [size, view]);
  const drawing = !readOnly && ['wall', 'guard-wall', 'rectangle', 'measure'].includes(tool);
  const wallPreview = (tool === 'wall' || tool === 'guard-wall') && !readOnly ? wallDraw : idleWallDraw();
  const wallLength = wallPreview.anchor && wallPreview.preview ? distance(wallPreview.anchor, wallPreview.preview) : 0;
  const draftDimension = wallPreview.anchor && wallPreview.preview ? drawingDimension(wallPreview.anchor, wallPreview.preview, view.scale) : null;
  const wallExtension = wallPreview.anchor && wallPreview.preview
    && tool === 'wall' ? snapWallPoint(doc, wallPreview.preview, view.scale, snapEnabled, wallPreview.anchor).extension : undefined;
  const wallMagnet = wallPreview.anchor && wallPreview.preview
    ? snapWallPoint(doc, wallPreview.preview, view.scale, snapEnabled, wallPreview.anchor) : undefined;
  const splitting = tool === 'split-wall' && !readOnly;
  const placingSpatial = tool === 'place-object' && !readOnly && !!pendingSpatial;
  const spatialPreview = useMemo(() => {
    if (!pendingSpatial || !pointer) return null;
    const origin = objectCenter({ ...pendingSpatial, x: 0, y: 0 });
    return snapObject(doc, { ...pendingSpatial, x: pointer.x - origin.x, y: pointer.y - origin.y }, view.scale, snapEnabled);
  }, [doc, pendingSpatial, pointer, snapEnabled, view.scale]);
  const splitPreview = splitting && pendingSplitWallId && pointer ? resolveWallSplitPoint(doc, pendingSplitWallId, pointer, view.scale) : null;
  const splitNormal = splitPreview ? { x: (splitPreview.to.y - splitPreview.from.y) / distance(splitPreview.from, splitPreview.to) * 40 / view.scale,
    y: -(splitPreview.to.x - splitPreview.from.x) / distance(splitPreview.from, splitPreview.to) * 40 / view.scale } : { x: 0, y: 0 };
  return <div className={styles.canvas} ref={container} aria-label="Lienzo del plano" tabIndex={0}
    onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }} onPointerCancel={cancel}>
    <Stage ref={stage} width={size.width} height={size.height} x={view.x} y={view.y}
      scaleX={view.scale} scaleY={view.scale} draggable={pan}
      onDragEnd={(e) => { if (e.target === stage.current) updateView({ ...view, ...e.target.position() }); }}
      onWheel={(e) => { e.evt.preventDefault(); zoom(e.evt.deltaY > 0 ? .9 : 1.1, stage.current?.getPointerPosition() ?? undefined); }}
      onPointerDown={(e) => {
        stage.current?.container().parentElement?.focus();
        if (pan) return;
        if (placingSpatial) {
          if (e.evt.button !== undefined && e.evt.button !== 0) return;
          const raw = stage.current?.getRelativePointerPosition();
          if (!raw || !pendingSpatial) return;
          const origin = objectCenter({ ...pendingSpatial, x: 0, y: 0 });
          const item = snapObject(doc, { ...pendingSpatial, x: raw.x - origin.x, y: raw.y - origin.y }, view.scale, snapEnabled);
          store.getState().placePendingSpatial(item); setPointer(null); return;
        }
        if (splitting) {
          if (e.evt.button !== undefined && e.evt.button !== 0) return;
          const p = point(); if (p) store.getState().commitWallSplit(p, view.scale); return;
        }
        if (drawing && (tool === 'wall' || tool === 'guard-wall')) {
          if (e.evt.button !== undefined && e.evt.button !== 0) return;
          if (e.evt.detail > 1) { cancel(); return; }
          const p = point(); if (!p) return;
          try {
            const current = store.getState();
            const extension = tool === 'wall' && wallDraw.anchor ? snapWallPoint(current.document, p, view.scale, current.snap, wallDraw.anchor).extension : undefined;
            const result = tool === 'guard-wall' ? clickGuardWallDraw(wallDraw, p, current.document)
              : clickWallDraw(wallDraw, p, current.document, extension);
            if (result.document) store.getState().apply(result.document);
            setWallDraw(result.state);
          } catch (error) { store.getState().setError(error instanceof Error ? error.message : 'No se puede unir este muro.'); }
          return;
        }
        if (tool === 'select' && e.target === stage.current) {
          const p = point(); if (!p) return;
          const mode = e.evt.altKey ? 'subtract' : e.evt.metaKey || e.evt.ctrlKey || e.evt.shiftKey ? 'add' : 'replace';
          setMarquee({ from: p, to: p, baseSelection: store.getState().selection, mode });
          return;
        }
        if (drawing) { const p = point(); if (p && !start) { setGesture({ point: p, tool }); setPointer(p); } }
      }} onPointerMove={() => {
        if (!pan && placingSpatial) { setPointer(stage.current?.getRelativePointerPosition() ?? null); return; }
        if (!pan && splitting) { setPointer(point()); return; }
        if (!pan && marquee) { const p = point(); if (p) setMarquee((current) => current ? { ...current, to: p } : null); return; }
        if (pan || !drawing) return;
        const p = point();
        if (p && (tool === 'wall' || tool === 'guard-wall')) setWallDraw((current) => moveWallDraw(current, p));
        else if (start) setPointer(p);
      }} onPointerUp={() => { if (!pan && marquee) finishMarquee(); else if (!pan && drawing && tool !== 'wall') finish(); }} onDblClick={cancel} onDblTap={cancel}>
      <Layer listening={false}>{grid.map((points, i) => <Line key={i} points={points} stroke="#e0e7e4" strokeWidth={1 / view.scale} />)}</Layer>
      <Layer key={`dimension-arrows-v1:${generation}:${tool}:${doc.activeLevelId}`} listening={!pan && active}><DocumentLayer store={store} scale={view.scale} disabled={pan || !active} /></Layer>
      <Layer listening={false}>{start && pointer && <Line points={tool === 'rectangle'
        ? [start.x, start.y, pointer.x, start.y, pointer.x, pointer.y, start.x, pointer.y, start.x, start.y]
        : [start.x, start.y, pointer.x, pointer.y]} stroke="#087f75" strokeWidth={2 / view.scale} dash={[8 / view.scale, 4 / view.scale]} />}</Layer>
      <Layer listening={false}>{wallPreview.anchor && wallPreview.preview && wallLength >= 50 && <>
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
      </>}</Layer>
      <Layer listening={false}>{start && pointer && tool === 'rectangle' && rectangleDimensions(start, pointer, view.scale)
        .map((layout, index) => <DimensionMark key={index} layout={layout} scale={view.scale} />)}</Layer>
      <Layer listening={false}>{marquee && <Rect x={Math.min(marquee.from.x, marquee.to.x)} y={Math.min(marquee.from.y, marquee.to.y)}
        width={Math.abs(marquee.to.x - marquee.from.x)} height={Math.abs(marquee.to.y - marquee.from.y)}
        fill="#087f7520" stroke="#087f75" strokeWidth={2 / view.scale} dash={[8 / view.scale, 4 / view.scale]} />}</Layer>
      <Layer listening={false}>{splitPreview && <>
        <Circle x={splitPreview.point.x} y={splitPreview.point.y} radius={7 / view.scale}
          fill={splitPreview.valid ? '#087f75' : '#b83232'} stroke="white" strokeWidth={2 / view.scale} />
        <DimensionMark scale={view.scale} layout={{ sourceFrom: splitPreview.from, sourceTo: splitPreview.point,
          from: { x: splitPreview.from.x + splitNormal.x, y: splitPreview.from.y + splitNormal.y },
          to: { x: splitPreview.point.x + splitNormal.x, y: splitPreview.point.y + splitNormal.y } }} />
      </>}</Layer>
      <Layer listening={false}>{spatialPreview && <Group x={spatialPreview.x} y={spatialPreview.y} rotation={spatialPreview.rotation} opacity={.72}>
        <Rect width={spatialPreview.widthMm} height={spatialPreview.depthMm} fill="#00a69355" stroke="#087f75" strokeWidth={2 / view.scale} />
        <Text width={spatialPreview.widthMm} y={spatialPreview.depthMm / 2 - 7 / view.scale} align="center" fill="#087f75" fontSize={12 / view.scale}
          text={'catalogId' in spatialPreview && spatialPreview.catalogId === 'builtin:column-rectangular' ? 'Columna · clic para colocar' : 'Copia · clic para colocar'} />
      </Group>}</Layer>
    </Stage>
    {wallExtension && <div role="status" style={{ position: 'absolute', top: 16, left: 16, padding: 8, background: '#fff', pointerEvents: 'none' }}>
      Cerrar habitación · prolongar pared existente sin añadir un tramo
    </div>}
    {!wallExtension && wallMagnet && wallMagnet.kind !== 'free' && <div role="status" style={{ position: 'absolute', top: 16, left: 16, padding: 8, background: '#fff', pointerEvents: 'none' }}>
      {wallMagnet.kind === 'orthogonal' ? 'Imán activo · pared recta' : wallMagnet.kind === 'landing'
        ? 'Imán activo · borde del descansillo' : 'Imán activo · unir al vértice'}
    </div>}
    {!pan && (tool === 'wall' || tool === 'guard-wall') && !wallExtension && (!wallMagnet || wallMagnet.kind === 'free') && <div role="status" style={{ position: 'absolute', top: 16, left: 16, padding: 8, background: '#fff', pointerEvents: 'none' }}>
      {tool === 'guard-wall' ? wallPreview.anchor ? 'Haz clic para terminar el murete de protección' : 'Haz clic en el inicio del murete · no arrastres'
        : wallPreview.anchor ? 'Haz clic para fijar el siguiente punto · vuelve al inicio para cerrar la habitación' : 'Haz clic para iniciar la pared · no arrastres'}
    </div>}
    {splitting && <div role="status" style={{ position: 'absolute', top: 16, left: 16, padding: 8, background: '#fff', pointerEvents: 'none' }}>
      {splitPreview?.reason ?? 'Haz clic sobre la pared para añadir una esquina · Esc para cancelar'}
    </div>}
    {placingSpatial && <div role="status" style={{ position: 'absolute', top: 16, left: 16, padding: 8, background: '#fff', pointerEvents: 'none' }}>
      Mueve la copia y haz clic para colocarla · Esc para cancelar
    </div>}
    {!pan && tool === 'select' && <div role="status" style={{ position: 'absolute', top: 16, left: 16, padding: 8, background: '#fff', pointerEvents: 'none' }}>
      Arrastra para seleccionar · Mayús/⌘/Ctrl suma · ⌥ resta · Flechas: 1 cm · Mayús+flechas: 10 cm · Supr elimina
    </div>}
    {!pan && <CanvasSelectionMenu store={store} view={view} size={size} />}
    {!doc.walls.length && !doc.furniture.length && !doc.stairs?.length && !doc.ramps?.length && <div className={styles.empty}>
      <strong>Tu espacio empieza aquí</strong><span>Traza un muro, dibuja una habitación o importa tu plano.</span>
    </div>}
    <div className={styles.navigation} aria-label="Navegación del lienzo">
      <button onClick={() => zoom(.8)} aria-label="Alejar">−</button><span>{Math.round(view.scale * 1000)}%</span>
      <button onClick={() => zoom(1.25)} aria-label="Acercar">+</button><button onClick={fit}>Encuadrar</button>
      <button aria-pressed={pan} onClick={() => { cancel(); setPan(!pan); }}>Mano</button>
      {(start || wallPreview.anchor) && <button onClick={cancel}>{wallPreview.anchor ? 'Finalizar paredes' : 'Cancelar trazo'}</button>}
      {splitting && <button onClick={cancel}>Cancelar esquina</button>}
    </div>
  </div>;
}
