'use client';
import { useLayoutEffect } from 'react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { parseWorkspaceDisplay } from '@/canvas/editor-v2/workspace-display';
import { workspaceViewKey } from './workspace-view-state';

export function useWorkspaceDisplay(store: EditorStore, owner?: string, projectId?: string, zoneId?: string | null) {
  const key = workspaceViewKey(owner, projectId, zoneId);
  useLayoutEffect(() => {
    if (!key) return;
    const displayKey = `${key}:display`;
    try { store.getState().setSceneOptions(parseWorkspaceDisplay(sessionStorage.getItem(displayKey))); }
    catch { /* El editor funciona también sin almacenamiento local. */ }
    return store.subscribe((next, previous) => {
      if (next.sceneOptions === previous.sceneOptions) return;
      try { sessionStorage.setItem(displayKey, JSON.stringify(next.sceneOptions)); }
      catch { /* Mantener los cambios en la sesión actual. */ }
    });
  }, [store, key]);
}
