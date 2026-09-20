'use client';

import { useEffect, useMemo, useState } from 'react';
import { walkthroughKeyframes } from '@/lib/editor-document/walkthrough-keyframes';
import { sameCameraPose, type StoryboardGalleryImage } from '@/lib/contracts/storyboard-image';
import { StoryboardImageCard } from './storyboard-image-card';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { setWalkthroughStoryboard, setStoryboardImage } from '@/lib/editor-document/walkthrough-storyboard';
import styles from './storyboard-panel.module.css';

export function StoryboardPanel({ store, onDesignPoint, onHide, busy, loadImages, imageRevision = 0 }: {
  store: EditorStore;
  loadImages?: () => Promise<StoryboardGalleryImage[]>;
  imageRevision?: number;
  onDesignPoint?: (id: string) => void;
  busy: boolean;
  onHide: () => void;
}) {
  const doc = useStore(store, (state) => state.document);
  const routeId = useStore(store, (state) => state.walkthroughId);
  const readOnly = useStore(store, (state) => state.readOnly);
  const route = doc.walkthroughs?.find((item) => item.id === routeId);
  const [refresh, setRefresh] = useState(0);
  const requestKey = JSON.stringify([routeId, imageRevision, refresh]);
  const [response, setResponse] = useState<{ key: string; images: StoryboardGalleryImage[]; error: string } | null>(null);
  const loading = !!loadImages && response?.key !== requestKey;
  const gallery = response?.key === requestKey ? response.images : [];
  const galleryError = response?.key === requestKey ? response.error : '';
  useEffect(() => {
    if (!routeId || !loadImages) return;
    let active = true;
    void loadImages().then((images) => {
      if (active) setResponse({ key: requestKey, images, error: '' });
    }).catch(() => {
      if (active) setResponse({ key: requestKey, images: [], error: 'No se pudo cargar la galería. Vuelve a intentarlo.' });
    });
    const timer = window.setTimeout(() => setRefresh((value) => value + 1), 8 * 60 * 1000);
    return () => { active = false; window.clearTimeout(timer); };
  }, [routeId, loadImages, requestKey]);
  const frames = useMemo(() => {
    try { return route ? walkthroughKeyframes(doc, route) : []; } catch { return []; }
  }, [doc, route]);
  if (!route) return null;
  const ids = route.storyboardWaypointIds ?? [];
  const available = route.waypoints.filter((point) => !ids.includes(point.id));
  const save = (next: string[]) => {
    const state = store.getState();
    if (state.readOnly || busy) return;
    try {
      state.apply(setWalkthroughStoryboard(state.document, route.id, next));
      state.setError(null);
    } catch (error) {
      state.setError(error instanceof Error ? error.message : 'No se pudieron guardar las vistas.');
    }
  };
  const move = (index: number, direction: number) => {
    const next = [...ids], target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    save(next);
  };
  return <section className={styles.panel} aria-label="Vistas del recorrido">
    <header className={styles.header}>
      <strong>Vistas · {route.name}</strong>
      <button type="button" onClick={onHide}>Ocultar recorrido</button>
      <span>{ids.length} seleccionadas</span>
      {loadImages && <button type="button" disabled={loading} onClick={() => setRefresh((value) => value + 1)}>{loading ? 'Cargando imágenes…' : 'Actualizar galería'}</button>}
      <label>Añadir punto
        <select aria-label="Añadir punto a las vistas" value="" disabled={readOnly || busy || !available.length}
          onChange={(event) => { if (event.target.value) save([...ids, event.target.value]); }}>
          <option value="">Elegir…</option>
          {available.map((point) => <option key={point.id} value={point.id}>Punto {route.waypoints.indexOf(point) + 1}</option>)}
        </select>
      </label>
      <button type="button" disabled={readOnly || busy || !available.length}
        onClick={() => save([...ids, ...available.map((point) => point.id)])}>Añadir todos</button>
    </header>
    {galleryError && <p role="alert">{galleryError}</p>}
    {!ids.length && <p>Elige los puntos que quieres convertir en imágenes. Preparar esta lista no consume créditos.</p>}
    {!!ids.length && <ol className={styles.strip}>
      {ids.map((id, index) => {
        const point = route.waypoints.find((item) => item.id === id)!;
        const image = route.storyboardImages?.find((item) => item.waypointId === id);
        const camera = frames.find((item) => item.waypointId === id)?.camera;
        const pointNumber = route.waypoints.indexOf(point) + 1;
        return <li className={styles.card} key={id}>
          <strong>Vista {index + 1} · Punto {pointNumber}</strong>
          <span>Altura {(point.eyeHeightMm / 1000).toFixed(2)} m</span>
          {loadImages && <StoryboardImageCard image={image} camera={camera} gallery={gallery} disabled={readOnly || busy || loading}
            onChoose={(candidate) => {
              const state = store.getState();
              if (state.readOnly || busy) return;
              try {
                const currentRoute = state.document.walkthroughs?.find((item) => item.id === route.id);
                const currentCamera = currentRoute && walkthroughKeyframes(state.document, currentRoute).find((item) => item.waypointId === id)?.camera;
                if (!currentCamera || !sameCameraPose(currentCamera, candidate.camera)) throw new Error('El encuadre cambió. Vuelve a elegir una imagen.');
                state.apply(setStoryboardImage(state.document, route.id, { waypointId: id, deliverableId: candidate.id, camera: candidate.camera }));
                state.setError(null);
              } catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo asociar la imagen.'); }
            }} />}
          <button type="button" disabled={readOnly || busy || !onDesignPoint || !camera} onClick={() => onDesignPoint?.(id)}>{image ? 'Regenerar esta vista' : 'Diseñar esta vista'}</button>
          <div className={styles.actions}>
            <button type="button" aria-label={`Adelantar vista ${index + 1}`} disabled={readOnly || busy || index === 0} onClick={() => move(index, -1)}>←</button>
            <button type="button" aria-label={`Retrasar vista ${index + 1}`} disabled={readOnly || busy || index === ids.length - 1} onClick={() => move(index, 1)}>→</button>
            <button type="button" aria-label={`Quitar vista ${index + 1}`} disabled={readOnly || busy} onClick={() => save(ids.filter((item) => item !== id))}>Quitar</button>
          </div>
        </li>;
      })}
    </ol>}
  </section>;
}
