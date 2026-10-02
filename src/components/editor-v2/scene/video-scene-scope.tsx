'use client';
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { ZoneMaskRegions } from '@/lib/editor-document/render-view';
import { isolateSceneToZone } from './zone-scene-isolation';
import { waitSceneModels } from './wait-scene-models';

/** La vista previa y el exportador aplican el mismo recorte a la geometría. */
export function VideoSceneScope({ regions, disabled, hideTerrain }: {
  regions: ZoneMaskRegions; disabled: boolean; hideTerrain: boolean;
}) {
  const scene = useThree(state => state.scene), invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    if (disabled || !regions.length) return;
    const controller = new AbortController();
    let restore: (() => void) | undefined;
    void waitSceneModels(scene, controller.signal).then(() => {
      if (controller.signal.aborted) return;
      restore = isolateSceneToZone(scene, regions, true, hideTerrain); invalidate();
    }).catch(error => { if (!controller.signal.aborted) console.warn('No se pudo preparar el ámbito del vídeo.', error); });
    return () => { controller.abort(); restore?.(); invalidate(); };
  }, [scene, regions, disabled, hideTerrain, invalidate]);
  return null;
}
