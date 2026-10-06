'use client';
import { useState } from 'react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { RoofOpening } from '@/lib/editor-document/roof-opening-types';
import type { EditorVisibility } from './visibility-menu';

export type RoofAction = 'configure' | 'edit' | 'preview' | 'hide' | RoofOpening['kind'];
export interface RoofPlacementRequest { kind: RoofOpening['kind']; token: number }

/** Un solo flujo compartido entre Construir, Herramientas y los controles del plano. */
export function useRoofWorkflow(store: EditorStore, visibility: EditorVisibility, setVisibility: (value: EditorVisibility) => void,
  setMode: (mode: '2d' | '3d') => void, closeConstruction: () => void) {
  const [open, setOpen] = useState(false), [request, setRequest] = useState<RoofPlacementRequest | null>(null);
  function action(value: RoofAction) {
    closeConstruction();
    store.getState().closeSidePanel();
    if (value === 'configure') { setOpen(true); return; }
    if (value === 'preview' || value === 'hide') {
      store.getState().setCeilingView(value === 'preview' ? 'solid' : 'hidden'); setMode('3d'); return;
    }
    store.getState().setTool('select');
    setMode('2d'); setVisibility({ ...visibility, roof: true });
    setRequest(value === 'edit' ? null : { kind: value, token: Date.now() });
  }
  return { open, setOpen, request, action };
}
