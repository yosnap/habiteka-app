'use client';

import { useMemo, useSyncExternalStore } from 'react';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { buildingDocuments } from '@/lib/editor-document/building-levels';
import { walkthroughNavigation } from '@/lib/editor-document/walkthrough-navigation';
import { freeWalkGuidance, freeWalkPlaces } from '@/lib/editor-document/free-walk-places';
import type { FreeWalkController } from './free-walk-controller';
import styles from './free-walk-overlay.module.css';

/** HUD de la visita: la estancia actual y el paso visible más cercano. */
export function FreeWalkGuide({ document, start, controller }: {
  document: EditorDocument;
  start: Point;
  controller: FreeWalkController;
}) {
  const pose = useSyncExternalStore(controller.subscribe, controller.getPose, controller.getPose);
  const levelId = pose?.levelId ?? document.activeLevelId ?? 'ground';
  const plan = useMemo(() => buildingDocuments(document).find((level) => level.id === levelId)?.document ?? document, [document, levelId]);
  const nav = useMemo(() => walkthroughNavigation(plan), [plan]);
  const places = useMemo(() => freeWalkPlaces(plan, nav), [plan, nav]);
  const guide = freeWalkGuidance(places, nav, pose ?? { ...start, yaw: 0 });

  return <div className={styles.guide}>
    <span className={styles.guideEyebrow}>Estás en</span>
    <strong aria-live="polite">{guide.current}</strong>
    <span className={styles.guideDestination}>
      {guide.destination ? <><span aria-live="polite">{guide.arrow} {guide.destination}</span>
        <span aria-hidden="true"> · {guide.distanceM!.toFixed(1)} m</span></>
        : places.portals.length ? 'Mira hacia una puerta para ver adónde lleva'
          : 'Explora esta estancia con WASD o las flechas'}
    </span>
    <span className={styles.guideControls}>↑ avanza · ↓ retrocede · ←/→ gira</span>
  </div>;
}
