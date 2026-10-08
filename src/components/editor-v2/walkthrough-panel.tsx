'use client';
import { useMemo, useState } from 'react';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { autoTour } from '@/lib/editor-document/auto-tour';
import { autoBuildingTour } from '@/lib/editor-document/building-auto-tour';
import { buildingStairLinks } from '@/lib/editor-document/building-stair-links';
import { putWalkthrough, removeWalkthrough, type WalkthroughWaypoint } from '@/lib/editor-document/walkthrough';
import { buildWalkthrough } from '@/lib/editor-document/walkthrough-geometry';
import { insideRoom } from '@/lib/editor-document/ceiling-geometry';
import styles from './ceiling-lighting.module.css';
import { ModernSelect } from '@/components/ui/modern-select';
import { walkthroughBlockReport } from '@/lib/editor-document/walkthrough-block-report';

export function WalkthroughPanel({ store, onDraw, onLocate, onPreview, onDesignPoint, onOpenApprovedRoute, portalContainer }: {
  store: EditorStore; onDraw: () => void; onLocate: () => void; onPreview: () => void;
  onDesignPoint?: (waypointId: string) => void; onOpenApprovedRoute?: (routeId: string) => Promise<void>;
  videoStudio?: boolean; portalContainer?: HTMLElement | null;
}) {
  const state = useStore(store), doc = state.document;
  const [zones, setZones] = useState<string[]>([]);
  const [openingApproved, setOpeningApproved] = useState(false);
  const rooms = useMemo(() => { try { return deriveRooms(doc); } catch { return []; } }, [doc]);
  const route = doc.walkthroughs?.find((p) => p.id === state.walkthroughId);
  const stairLinks = useMemo(() => buildingStairLinks(doc).filter((link) =>
    link.lowerLevelId === doc.activeLevelId || link.upperLevelId === doc.activeLevelId), [doc]);
  const multiLevel = Boolean(route?.waypoints.some((point) => point.levelId));
  const compiled = useMemo(() => {
    if (!route) return { error: '', value: null };
    try { return { value: buildWalkthrough(doc, route), error: '' }; }
    catch (error) { return { error: error instanceof Error ? error.message : 'Ruta inválida', value: null }; }
  }, [doc, route]);
  const blockedSegments = compiled.value?.blockedSegments ?? [];
  const run = (work: () => void) => { try { work(); state.setError(null); } catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo preparar el recorrido'); } };
  const update = (id: string, patch: Partial<WalkthroughWaypoint>) => run(() => {
    if (route) state.apply(putWalkthrough(doc, { ...route, waypoints: route.waypoints.map((p) => p.id === id ? { ...p, ...patch } : p) }));
  });
  return <aside className={styles.panel} aria-label="Recorrido por el plano">
    <p>Este recorrido es una guía para comprobar pasos y geometría en el plano. Los vídeos y visitas finales parten de diseños IA aceptados. Las puertas de paso deben estar abiertas.</p>
    {!!doc.walkthroughs?.length && <label>Recorrido guardado (elige uno para recuperarlo)<ModernSelect portalContainer={portalContainer} popoverZIndex={200} value={route?.id ?? ''} onChange={(e) => state.setWalkthrough(e.target.value || null)}>
      <option value="">Elige un recorrido</option>{doc.walkthroughs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </ModernSelect></label>}
    {route && <>
      {compiled.error && <p role="status">{compiled.error}</p>}
      {compiled.value && <p>Duración: {(compiled.value.durationMs / 1000).toFixed(1)} s · Sin consumo de IA</p>}
      {!!blockedSegments.length && <p role="status">{blockedSegments.length} tramos bloqueados. Revisa el informe debajo de los puntos.</p>}
      <button type="button" disabled={!compiled.value || !!compiled.value.invalidSegments.length} onClick={onPreview}>Previsualizar en 3D</button>
      {onOpenApprovedRoute && <button type="button" className={styles.primary} disabled={openingApproved || !compiled.value || !!compiled.value.invalidSegments.length}
        onClick={() => { setOpeningApproved(true); void onOpenApprovedRoute(route.id).finally(() => setOpeningApproved(false)); }}>
        {openingApproved ? 'Abriendo guía aprobada…' : 'Ver guía aprobada'}
      </button>}
    </>}
    <fieldset disabled={state.readOnly}>
      <legend>Estancias a visitar</legend>
      {rooms.map((room, index) => <label className={styles.check} key={room.id}>
        <input type="checkbox" checked={zones.includes(room.id)} onChange={(e) => setZones(e.target.checked ? [...zones, room.id] : zones.filter((id) => id !== room.id))} />
        {doc.labels.find((label) => insideRoom(label, room.boundary))?.text ?? `Estancia ${index + 1}`} · {(room.areaMm2 / 1e6).toFixed(1)} m²
      </label>)}
      {!rooms.length && <p>Primero dibuja una habitación cerrada.</p>}
      <button type="button" disabled={!zones.length} onClick={() => run(() => {
        const path = autoTour(doc, zones); state.apply(putWalkthrough(doc, path)); state.setWalkthrough(path.id);
      })}>Preparar recorrido automático</button>
      <button type="button" disabled={!rooms.length} title="Solo crea la guía si puede conectar todas las zonas; si falta alguna, informa del bloqueo" onClick={() => run(() => {
        const path = autoTour(doc, rooms.map((room) => room.id), { name: 'Guía por todas las zonas' });
        state.apply(putWalkthrough(doc, path)); state.setWalkthrough(path.id);
      })}>Guía por todas las zonas</button>
      <button type="button" onClick={() => run(() => {
        const path = { id: crypto.randomUUID(), name: 'Recorrido manual', zoneIds: [], waypoints: [], loop: false };
        state.apply(putWalkthrough(doc, path)); state.setWalkthrough(path.id); onDraw();
      })}>Dibujar recorrido</button>
    </fieldset>
    {!!stairLinks.length && <fieldset disabled={state.readOnly}>
      <legend>Entre plantas</legend>
      <p>Prepara una guía por los peldaños y la salida superior para comprobar el paso en 3D. El vídeo final necesita los diseños IA aceptados de ambas plantas.</p>
      {stairLinks.map((link) => <button type="button" key={`${link.lowerLevelId}:${link.upperLevelId}:${link.stairId}`} onClick={() => run(() => {
        const destination = link.lowerLevelId === doc.activeLevelId ? link.upperLevelId : link.lowerLevelId;
        const path = autoBuildingTour(doc, link.stairId, destination), checked = buildWalkthrough(doc, path);
        if (checked.invalidSegments.length) throw new Error('La escalera tiene un tramo bloqueado. Despeja el paso antes de preparar la ruta.');
        state.apply(putWalkthrough(doc, path)); state.setWalkthrough(path.id);
      })}>{link.lowerLevelId === doc.activeLevelId ? 'Subir' : 'Bajar'} por escalera a {doc.levels?.find((level) =>
        level.id === (link.lowerLevelId === doc.activeLevelId ? link.upperLevelId : link.lowerLevelId))?.name ?? 'otra planta'}</button>)}
    </fieldset>}
    {route && <>
      <fieldset disabled={state.readOnly}>
        <label>Nombre<input value={route.name} maxLength={80} onChange={(e) => run(() => state.apply(putWalkthrough(doc, { ...route, name: e.target.value })))} /></label>
        {!multiLevel && <label className={styles.check}><input type="checkbox" checked={route.loop} onChange={(e) => run(() => state.apply(putWalkthrough(doc, { ...route, loop: e.target.checked })))} />Cerrar ruta en bucle</label>}
        {!multiLevel && (state.tool === 'walkthrough' ? <>
          <p>Haz clic en cada punto del plano. Pulsa «Terminar trazado» o Intro cuando acabes; Esc sale del modo de dibujo.</p>
          <button type="button" onClick={() => state.setTool('select')}>Terminar trazado · {route.waypoints.length} {route.waypoints.length === 1 ? 'punto' : 'puntos'}</button>
        </> : <button type="button" onClick={onDraw}>Añadir puntos en el plano</button>)}
        {multiLevel && <p>En 2D se ven los puntos de la planta inicial. Ajusta las coordenadas de la otra planta en esta lista; la ruta cruza por la escalera validada.</p>}
        <p>Arrastra los puntos numerados en 2D para ajustar el paso.</p>
        {route.waypoints.map((point, index) => <details key={point.id} className={styles.light}>
          <summary>Punto {index + 1}{point.levelId ? ` · ${doc.levels?.find((level) => level.id === point.levelId)?.name ?? 'Otra planta'}` : ''}</summary>
          {onDesignPoint && !multiLevel && <button type="button" disabled={!compiled.value || !!compiled.value.invalidSegments.length} onClick={() => onDesignPoint(point.id)}>Diseñar desde este punto</button>}<div className={styles.fields}>
            {(['x', 'y', 'eyeHeightMm', 'speedMmPerS', 'dwellMs'] as const).map((key) => <label key={key}>
              {{ x: 'X (m)', y: 'Y (m)', eyeHeightMm: 'Altura cámara (m)', speedMmPerS: 'Velocidad (m/s)', dwellMs: 'Pausa (s)' }[key]}
              <input type="number" step="0.1" value={point[key] / 1000} onChange={(e) => update(point.id, { [key]: Number(e.target.value) * 1000 })} />
            </label>)}
            <label>Orientación (°)<input type="number" placeholder="Según la ruta" value={point.yawDeg ?? ''} onChange={(e) => update(point.id, { yawDeg: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
          </div><button type="button" onClick={() => run(() => state.apply(putWalkthrough(doc, { ...route, waypoints: route.waypoints.filter((p) => p.id !== point.id) })))}>Eliminar punto</button>
        </details>)}
        <button type="button" className={styles.danger} onClick={() => run(() => { state.apply(removeWalkthrough(doc, route.id)); state.setWalkthrough(null); })}>Eliminar recorrido</button>
      </fieldset>
      {!!blockedSegments.length && <section className={styles.blockReport} role="alert" aria-label="Informe de tramos bloqueados">
        <strong>{blockedSegments.length} {blockedSegments.length === 1 ? 'tramo bloqueado' : 'tramos bloqueados'}</strong>
        <p>Primer obstáculo de cada tramo, comprobado con la misma geometría que usa la visita. Los tramos bloqueados aparecen en rojo en el plano 2D:</p>
        <ol>{blockedSegments.map(({ index, block }) => {
          const report = walkthroughBlockReport(doc, block, route.zoneIds.length > 0);
          return <li key={index} className={state.walkthroughFocusIndex === index ? styles.activeBlock : undefined}>
            <strong>Tramo {index + 1}: punto {index + 1} → {index + 2 > route.waypoints.length ? 1 : index + 2}</strong>
            <p>{report.cause}</p><p>{report.action}</p>
            <small>Primer bloqueo: X {(block.point.x / 1000).toFixed(2)} m · Y {(block.point.y / 1000).toFixed(2)} m</small>
            <button type="button" onClick={() => {
              onLocate();
              state.focusWalkthroughSegment(index);
              state.focusOn(block.point);
              if (block.entityId && [...doc.walls, ...doc.openings, ...doc.furniture, ...(doc.columns ?? []), ...(doc.stairs ?? [])]
                .some((item) => item.id === block.entityId)) state.select([block.entityId]);
              store.getState().openSidePanel('walkthrough');
            }}>Localizar en el plano</button>
          </li>;
        })}</ol>
      </section>}
    </>}
  </aside>;
}
