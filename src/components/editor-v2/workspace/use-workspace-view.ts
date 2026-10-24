'use client';

import { useCallback, useState, useSyncExternalStore, type SetStateAction } from 'react';
import type { EditorViewMode } from '@/canvas/editor-v2/view-mode';
import { readWorkspaceView, workspaceViewKey, writeWorkspaceView } from './workspace-view-state';

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const serverSnapshot = (): EditorViewMode => '2d';

/** SSR estable; al hidratar recupera la vista de este usuario, proyecto y zona. */
export function useWorkspaceView(owner?: string, projectId?: string, zoneId?: string | null) {
  const key = workspaceViewKey(owner, projectId, zoneId);
  const [local, setLocal] = useState<EditorViewMode>('2d');
  const getSnapshot = useCallback(() => readWorkspaceView(key), [key]);
  const persisted = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const setMode = useCallback(
    (value: SetStateAction<EditorViewMode>) => {
      if (!key) {
        setLocal(value);
        return;
      }
      const next = typeof value === 'function' ? value(readWorkspaceView(key)) : value;
      writeWorkspaceView(key, next);
      listeners.forEach((listener) => listener());
    },
    [key],
  );
  return [key ? persisted : local, setMode] as const;
}
