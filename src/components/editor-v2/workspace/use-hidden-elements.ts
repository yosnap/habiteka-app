'use client';
import { useMemo } from 'react';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';

/** Estado visual de esta sesión; no filtra el documento usado por geometría o colisiones. */
export function useHiddenElements(store: EditorStore) {
  const ids = useStore(store, (s) => s.hiddenElementIds);
  return useMemo(() => new Set(ids), [ids]);
}
