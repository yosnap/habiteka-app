'use client';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Object3D } from 'three';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { useHiddenElements } from '../workspace/use-hidden-elements';

/** La máscara de capas evita sobrescribir la visibilidad propia de techo, muros y recortes. */
export function hideSceneElements(scene: Object3D, ids: ReadonlySet<string>): () => void {
  const changed: { object: Object3D; mask: number }[] = [];
  const visit = (object: Object3D, ancestorHidden = false) => {
    const hidden =
      ancestorHidden ||
      ids.has(object.userData.sourceEntityId) ||
      ids.has(object.userData.buildKey);
    if (hidden && object.layers.mask !== 0) {
      changed.push({ object, mask: object.layers.mask });
      object.layers.mask = 0;
    }
    object.children.forEach((child) => visit(child, hidden));
  };
  visit(scene);
  return () =>
    changed.forEach(({ object, mask }) => {
      object.layers.mask = mask;
    });
}

/** Antes de capturas o recorridos restaura la arquitectura completa. También cubre modelos que cargan después. */
export function SceneElementVisibility({
  store,
  disabled,
  extraIds,
}: {
  store: EditorStore;
  disabled: boolean;
  extraIds?: readonly string[];
}) {
  const original = useHiddenElements(store);
  const hidden = useMemo(() => new Set([...original, ...(extraIds ?? [])]), [original, extraIds]);
  const scene = useThree((s) => s.scene),
    invalidate = useThree((s) => s.invalidate);
  const restore = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    restore.current?.();
    restore.current = null;
    invalidate();
    return () => {
      restore.current?.();
      restore.current = null;
      invalidate();
    };
  }, [hidden, disabled, scene, invalidate]);
  useFrame(() => {
    restore.current?.();
    restore.current = null;
    if (!disabled && hidden.size) restore.current = hideSceneElements(scene, hidden);
  }, -10);
  return null;
}
