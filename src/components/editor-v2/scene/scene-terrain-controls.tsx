'use client';
import { useCallback, useEffect, useRef, type PointerEvent } from 'react';
import { Html, Line } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { EditorDocument, Point, TerrainSurface } from '@/lib/editor-document/schema';
import { updateTerrainSurface } from '@/lib/editor-document/terrain-surfaces';
import { snapTerrainMove, snapTerrainResize, TERRAIN_HANDLES } from '@/canvas/editor-v2/terrain-transform';
import { scenePlanPoint, scenePlanScale, type PlanMovePreview } from './scene-plan-interaction';

export function SceneTerrainControls({ store, source, preview, movePreview, elevation, onPreview }: {
  store: EditorStore; source: EditorDocument; preview: TerrainSurface | null;
  movePreview: PlanMovePreview | null; elevation: number; onPreview: (surface: TerrainSurface | null) => void;
}) {
  const sceneState = useThree();
  const root = useRef(sceneState);
  const selection = useStore(store, s => s.selection), tool = useStore(store, s => s.tool);
  const pan = useStore(store, s => s.pan), readOnly = useStore(store, s => s.readOnly);
  const guides = useStore(store, s => s.magneticGuides);
  const surface = selection.length === 1 ? source.terrainSurfaces?.find(item => item.id === selection[0]) : undefined;
  const gesture = useRef<{ handle: number; start: Point; node: HTMLButtonElement; pointerId: number; next: TerrainSurface | null } | null>(null);
  const enabled = Boolean(surface && tool === 'select' && !pan && !readOnly);
  useEffect(() => {
    const cancel = () => {
      const active = gesture.current; gesture.current = null;
      if (!active) return;
      if (active.node.hasPointerCapture(active.pointerId)) active.node.releasePointerCapture(active.pointerId);
      onPreview(null); store.getState().setMagneticGuides([]);
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    window.addEventListener('keydown', key);
    window.addEventListener('blur', cancel);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('blur', cancel); cancel(); };
  }, [source, surface?.id, enabled, store, onPreview]);
  const down = (event: PointerEvent<HTMLButtonElement>, handle: number) => {
    event.stopPropagation(); if (event.button !== 0) return;
    const start = scenePlanPoint(root, event.clientX, event.clientY, elevation); if (!start) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { handle, start, node: event.currentTarget, pointerId: event.pointerId, next: null };
  };
  const move = useCallback((event: globalThis.PointerEvent) => {
    const active = gesture.current;
    if (!surface || !active || event.pointerId !== active.pointerId) return;
    event.stopPropagation();
    const point = scenePlanPoint(root, event.clientX, event.clientY, elevation); if (!point) return;
    const state = store.getState(), scale = scenePlanScale(root, elevation);
    if (active.handle < 0) {
      const result = snapTerrainMove(source, surface, { x: point.x - active.start.x, y: point.y - active.start.y }, scale, state.snap);
      active.next = { ...surface, x: surface.x + result.delta.x, y: surface.y + result.delta.y };
      state.setMagneticGuides(result.guides);
    } else {
      const result = snapTerrainResize(source, surface, active.handle, point, scale, state.snap);
      active.next = result.surface; state.setMagneticGuides(result.guides);
    }
    onPreview(active.next);
  }, [store, source, surface, elevation, onPreview]);
  const end = useCallback((event: globalThis.PointerEvent, commit: boolean) => {
    const active = gesture.current;
    if (!surface || !active || event.pointerId !== active.pointerId) return;
    event.stopPropagation();
    gesture.current = null;
    if (active.node.hasPointerCapture(active.pointerId)) active.node.releasePointerCapture(active.pointerId);
    onPreview(null); store.getState().setMagneticGuides([]);
    if (commit && active.next) try {
      const { x, y, widthMm, depthMm } = active.next;
      store.getState().apply(updateTerrainSurface(source, surface.id, { x, y, widthMm, depthMm }));
    } catch (error) { store.getState().setError(error instanceof Error ? error.message : 'No se pudo ajustar la superficie.'); }
  }, [store, source, surface, onPreview]);
  useEffect(() => {
    // Html vive en un portal de R3F. La captura nativa termina el gesto incluso
    // si el tirador cambia de posición o el puntero acaba fuera de ese portal.
    const up = (event: globalThis.PointerEvent) => end(event, true);
    const cancel = (event: globalThis.PointerEvent) => end(event, false);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    return () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
    };
  }, [move, end]);
  if (!enabled || !surface) return null;
  const current = preview?.id === surface.id ? preview : movePreview?.id === surface.id
    ? { ...surface, x: surface.x + movePreview.dxMm, y: surface.y + movePreview.dyMm } : surface;
  const position = (x: number, y: number): [number, number, number] => [x / 1000, elevation + .05, y / 1000];
  return <group>
    <Line points={[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]].map(([x, y]) => position(current.x + x! * current.widthMm, current.y + y! * current.depthMm))}
      color="#087f75" lineWidth={2} depthTest={false} raycast={() => undefined} />
    {guides.map((guide, index) => <Line key={index} points={[position(guide.from.x, guide.from.y), position(guide.to.x, guide.to.y)]}
      color="#087f75" lineWidth={1} dashed dashSize={.1} gapSize={.05} depthTest={false} raycast={() => undefined} />)}
    {[...TERRAIN_HANDLES, [.5, .5] as const].map(([hx, hy], index) => <Html key={index} center zIndexRange={[3, 2]}
      position={position(current.x + hx * current.widthMm, current.y + hy * current.depthMm)}>
      <button type="button" aria-label={index === 8 ? 'Mover superficie' : `Redimensionar superficie: tirador ${index + 1}`}
        style={{ display: 'grid', placeItems: 'center', width: index === 8 ? 28 : 14, height: index === 8 ? 28 : 14, minWidth: 0, minHeight: 0,
          padding: 0, border: '2px solid #087f75', borderRadius: index === 8 ? '50%' : 3, background: 'white', color: '#087f75', touchAction: 'none',
          cursor: index === 8 ? 'move' : hx === .5 ? 'ns-resize' : hy === .5 ? 'ew-resize' : hx === hy ? 'nwse-resize' : 'nesw-resize' }}
        onClick={event => event.stopPropagation()} onPointerDown={event => down(event, index === 8 ? -1 : index)}
        onLostPointerCapture={event => end(event.nativeEvent, false)}>
        {index === 8 ? '✥' : null}
      </button>
    </Html>)}
  </group>;
}
