'use client';
import { useEffect, useMemo, useState } from 'react';
import type Konva from 'konva';
import type { RefObject } from 'react';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { Point } from '@/lib/editor-document/schema';
import type { RoofOpening } from '@/lib/editor-document/roof-opening-types';
import { deleteRoofOpening, makeRoofGlassEditable, putRoofOpening, placedRoofOpening } from '@/lib/editor-document/roof-opening-commands';
import { setExteriorRoof } from '@/lib/editor-document/exterior-roof';
import type { RoofPlacementRequest } from './use-roof-workflow';

export function useRoofPlanTool(store: EditorStore, enabled: boolean, stage: RefObject<Konva.Stage | null>, request?: RoofPlacementRequest | null) {
  const doc = useStore(store, state => state.document), readOnly = useStore(store, state => state.readOnly);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placing, setPlacing] = useState<RoofOpening['kind'] | null>(null);
  const [draft, setDraft] = useState<{ from: Point; to: Point } | null>(null);
  const [error, setError] = useState('');
  const [hover, setHover] = useState<Point | null>(null);
  const [wasEnabled, setWasEnabled] = useState(enabled);
  const [consumedRequest, setConsumedRequest] = useState<RoofPlacementRequest | null>(null);
  // Ajuste condicionado a los props: evita un segundo render disparado por un efecto.
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    if (!enabled) { setPlacing(null); setDraft(null); setHover(null); }
  }
  if (enabled && request && request !== consumedRequest) {
    setConsumedRequest(request); setPlacing(request.kind); setDraft(null); setHover(null); setError('');
  }
  const selected = doc.exteriorRoof?.openings?.find(item => item.id === selectedId) ?? null;
  useEffect(() => store.subscribe((next, previous) => {
    if (next.readOnly !== previous.readOnly || next.document.activeLevelId !== previous.document.activeLevelId || next.document !== previous.document) setDraft(null);
  }), [store]);
  useEffect(() => { if (enabled) { store.getState().setTool('select'); store.getState().select([]); } }, [enabled, store]);
  const preview = useMemo(() => {
    if (!enabled || !placing || (!draft && !hover)) return null;
    try {
      const opening = placedRoofOpening(draft?.from ?? hover!, draft?.to ?? hover!, placing, 'roof-placement-preview');
      try { putRoofOpening(doc, opening); return { opening, error: '' }; }
      catch (cause) { return { opening, error: cause instanceof Error ? cause.message : 'Posición no válida.' }; }
    } catch { return null; }
  }, [doc, enabled, placing, draft, hover]);
  function apply(operation: (document: typeof doc) => typeof doc) {
    if (store.getState().readOnly) return false;
    try { const next = operation(store.getState().document); store.getState().apply(next); setError(''); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Revisa el cristal o la ventana de techo.'); return false; }
  }
  const update = (opening: RoofOpening) => apply(current => putRoofOpening(current, opening));
  const remove = () => selected && apply(current => deleteRoofOpening(current, selected.id));
  const point = () => stage.current?.getRelativePointerPosition();
  return { doc, readOnly, selected, selectedId, setSelectedId, placing, preview, error, update, remove,
    choose: (kind: RoofOpening['kind'] | null) => { setPlacing(kind); setDraft(null); setHover(null); setError(''); },
    addRoof: () => apply(current => setExteriorRoof(current, {})),
    convert: () => apply(makeRoofGlassEditable),
    pointerDown: () => {
      if (!enabled || readOnly) return;
      const p = point();
      if (placing && p) setDraft({ from: p, to: p });
      else setSelectedId(null);
    },
    pointerMove: () => { const p = point(); if (enabled && placing && p) { setHover(p); if (draft) setDraft({ ...draft, to: p }); } },
    pointerUp: () => {
      if (!draft || !placing || !enabled) return;
      try {
        const opening = placedRoofOpening(draft.from, point() ?? draft.to, placing);
        if (update(opening)) { setSelectedId(opening.id); setPlacing(null); }
      } catch { setError('Dibuja una pieza de al menos 20 × 20 cm, o haz un clic para colocar su tamaño inicial.'); }
      setDraft(null);
    },
    keyDown: (event: React.KeyboardEvent) => {
      if (!enabled || ['INPUT', 'SELECT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setDraft(null); setPlacing(null); setSelectedId(null); }
      else if ((event.key === 'Delete' || event.key === 'Backspace') && selected) { event.preventDefault(); event.stopPropagation(); remove(); }
    },
  };
}
export type RoofPlanTool = ReturnType<typeof useRoofPlanTool>;
