'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from 'zustand';
import { PerspectiveCamera, Vector3 } from 'three';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { buildWalkthrough, type WalkthroughPose } from '@/lib/editor-document/walkthrough-geometry';
import type { Camera } from 'three';

export function applyWalkPose(camera: Camera, pose: WalkthroughPose, elevationMm: number) {
  camera.position.set(pose.position[0], pose.position[1] + elevationMm / 1000, pose.position[2]);
  camera.lookAt(pose.focus[0], pose.focus[1] + elevationMm / 1000, pose.focus[2]);
}
export function WalkCamera({ store, elevationMm }: { store: EditorStore; elevationMm: number }) {
  const doc = useStore(store, (s) => s.document), id = useStore(store, (s) => s.walkthroughId);
  const playing = useStore(store, (s) => s.walkthroughPlaying);
  const { get, invalidate } = useThree(), elapsed = useRef(0);
  const compiled = useMemo(() => {
    const route = doc.walkthroughs?.find((r) => r.id === id);
    try { return route ? buildWalkthrough(doc, route) : null; } catch { return null; }
  }, [doc, id]);
  useEffect(() => {
    if (!playing || !compiled || compiled.invalidSegments.length) return;
    const { camera, controls } = get();
    const orbit = controls as unknown as { enabled: boolean; target: Vector3; update: () => void } | null;
    const position = camera.position.clone(), quaternion = camera.quaternion.clone(), target = orbit?.target.clone();
    const enabled = orbit?.enabled; if (orbit) orbit.enabled = false;
    const fov = camera instanceof PerspectiveCamera ? camera.fov : null;
    if (camera instanceof PerspectiveCamera) { camera.fov = 75; camera.updateProjectionMatrix(); }
    elapsed.current = 0; invalidate();
    return () => {
      if (camera instanceof PerspectiveCamera && fov !== null) { camera.fov = fov; camera.updateProjectionMatrix(); }
      camera.position.copy(position); camera.quaternion.copy(quaternion);
      if (orbit) { orbit.enabled = enabled!; if (target) orbit.target.copy(target); orbit.update(); }
      invalidate();
    };
  }, [playing, compiled, get, invalidate]);
  useEffect(() => store.subscribe((next, previous) => {
    if (next.document !== previous.document || next.walkthroughId !== previous.walkthroughId) next.setWalkthroughPlaying(false);
  }), [store]);
  useFrame(({ camera }, delta) => {
    if (!playing || !compiled || compiled.invalidSegments.length) return;
    elapsed.current += Math.min(delta, .1) * 1000;
    if (elapsed.current > compiled.durationMs) {
      if (doc.walkthroughs?.find((r) => r.id === id)?.loop) elapsed.current %= compiled.durationMs;
      else { store.getState().setWalkthroughPlaying(false); return; }
    }
    applyWalkPose(camera, compiled.samplePose(elapsed.current), elevationMm); invalidate();
  });
  return null;
}
