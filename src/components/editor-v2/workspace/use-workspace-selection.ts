'use client';

import { useEffect } from 'react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { planElementIndex } from '@/lib/editor-document/plan-element-index';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { readWorkspaceView, workspaceViewKey } from './workspace-view-state';
import { prepareViewChange } from '@/canvas/editor-v2/view-mode';

/** Selecciones válidas al regresar, sin restaurar trazos ni colocaciones en curso. */
export function useWorkspaceSelection(
  store: EditorStore,
  owner?: string,
  projectId?: string,
  zoneId?: string | null,
) {
  const key = workspaceViewKey(owner, projectId, zoneId);
  useEffect(() => {
    if (!key) return;
    const selectionKey = `${key}:selection`;
    const initial = store.getState();
    if (readWorkspaceView(key) === '3d') prepareViewChange(store, '2d', '3d');
    try {
      const raw = JSON.parse(sessionStorage.getItem(selectionKey) ?? 'null') as {
        level?: unknown;
        ids?: unknown;
        ceilingView?: unknown;
      } | null;
      if (
        raw?.level === (initial.document.activeLevelId ?? null) &&
        Array.isArray(raw.ids) &&
        !initial.pendingSpatial &&
        initial.tool === 'select'
      ) {
        if (
          raw.ceilingView === 'hidden' ||
          raw.ceilingView === 'transparent' ||
          raw.ceilingView === 'solid'
        )
          initial.setCeilingView(raw.ceilingView);
        let rooms: ReturnType<typeof deriveRooms> = [];
        try {
          rooms = deriveRooms(initial.document);
        } catch {
          /* Solo los elementos indexables. */
        }
        const valid = new Set(planElementIndex(initial.document, rooms).map((entry) => entry.id));
        const ids = raw.ids.filter((id): id is string => typeof id === 'string' && valid.has(id));
        if (ids.length) initial.select(ids);
      }
    } catch {
      /* Preferencia obsoleta: no altera el documento. */
    }
    const save = () => {
      const state = store.getState();
      if (state.pendingSpatial || state.tool !== 'select') return;
      try {
        sessionStorage.setItem(
          selectionKey,
          JSON.stringify({
            level: state.document.activeLevelId ?? null,
            ids: state.selection,
            ceilingView: state.ceilingView,
          }),
        );
      } catch {
        /* Almacenamiento opcional. */
      }
    };
    const unsubscribe = store.subscribe((next, previous) => {
      if (
        next.selection !== previous.selection ||
        next.ceilingView !== previous.ceilingView ||
        next.document.activeLevelId !== previous.document.activeLevelId
      )
        save();
    });
    return () => {
      save();
      unsubscribe();
    };
  }, [store, key]);
}
