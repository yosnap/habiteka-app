import type { MagneticGuide } from './magnetic-alignment';
import { createStore } from 'zustand/vanilla';
import type { EditorDocument, Opening, Point } from '@/lib/editor-document/schema';
import { reconcileCeilings } from '@/lib/editor-document/ceiling-reconciliation';
import { luminairePlacementIssue } from '@/lib/editor-document/ceiling-geometry';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { applyCommand } from '@/lib/editor-document/commands';
import { addStair } from '@/lib/editor-document/construction-commands';
import { distance, wallPoints } from '@/lib/editor-document/geometry';
import { assertSpatialPlacement, placeNewObject } from './spatial-placement';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { wallPath } from '@/lib/editor-document/wall-path';
import { duplicateSpatialItem, findSpatialItem, insertSpatialItem, type SpatialClipboardItem } from './spatial-clipboard';

export type EditorTool = 'valla-madera' | 'cerca-metal' | 'seto' | 'patio' | 'select' | 'wall' | 'guard-wall' | 'rectangle' | 'door' | 'window' | 'passage' | 'measure' | 'split-wall' | 'place-object' | 'walkthrough';
export interface EditorState {
  detailAnchor: Point | null;
  setDetailAnchor: (point: Point) => void;
  magneticGuides: MagneticGuide[];
  setMagneticGuides: (guides: MagneticGuide[]) => void;
  walkthroughId: string | null;
  walkthroughPlaying: boolean;
  hideWalkthrough: () => void;
  setWalkthrough: (id: string | null) => void;
  setWalkthroughPlaying: (playing: boolean) => void;
  ceilingView: 'hidden' | 'transparent' | 'solid';
  setCeilingView: (view: 'hidden' | 'transparent' | 'solid') => void;
  detailPanel: 'paint' | 'comments' | null;
  setDetailPanel: (panel: 'paint' | 'comments' | null) => void;
  readOnly: boolean;
  document: EditorDocument;
  past: EditorDocument[];
  future: EditorDocument[];
  selection: string[];
  tool: EditorTool;
  pendingOpening: Opening | null;
  copyOpening: (id: string) => void;
  copyStair: (id: string) => void;
  clipboardSpatial: SpatialClipboardItem | null;
  pendingSpatial: SpatialClipboardItem | null;
  copySpatial: (id: string) => void;
  beginPasteSpatial: () => void;
  placePendingSpatial: (item: SpatialClipboardItem) => void;
  cancelPendingSpatial: () => void;
  pendingSplitWallId: string | null;
  beginWallSplit: (id: string) => void;
  cancelWallSplit: () => void;
  commitWallSplit: (point: Point, scale: number) => boolean;
  snap: boolean;
  sequence: number;
  error: string | null;
  apply: (document: EditorDocument) => void;
  undo: () => void;
  redo: () => void;
  select: (ids: string[]) => void;
  setTool: (tool: EditorTool) => void;
  setSnap: (enabled: boolean) => void;
  setError: (error: string | null) => void;
  restore: (document: EditorDocument) => void;
}

/** Instancia por usuario/proyecto/zona; ni historia ni selección viven en un singleton. */
export function createEditorStore(initial: EditorDocument, options: { readOnly?: boolean } = {}) {
  return createStore<EditorState>((set, get) => ({
    detailAnchor: null, setDetailAnchor: (detailAnchor) => set({ detailAnchor }),
    magneticGuides: [], setMagneticGuides: (magneticGuides) => set({ magneticGuides }),
    walkthroughId: null, walkthroughPlaying: false,
    hideWalkthrough: () => set({ walkthroughId: null, walkthroughPlaying: false, tool: 'select' }),
    setWalkthrough: (walkthroughId) => set({ walkthroughId, walkthroughPlaying: false }),
    setWalkthroughPlaying: (walkthroughPlaying) => set({ walkthroughPlaying }),
    ceilingView: 'transparent',
    setCeilingView: (ceilingView) => set({ ceilingView }),
    detailPanel: null,
    setDetailPanel: (detailPanel) => set({ detailPanel }),
    readOnly: options.readOnly ?? false,
    document: parseEditorDocument(initial), past: [], future: [], selection: [],
    tool: 'select', pendingOpening: null, pendingSplitWallId: null, clipboardSpatial: null, pendingSpatial: null, snap: true, sequence: 0, error: null,
    beginWallSplit: (id) => {
      const state = get(); if (state.readOnly || !state.document.walls.some((w) => w.id === id)) return;
      set({ pendingSplitWallId: id, pendingOpening: null, tool: 'split-wall', selection: [id], error: null });
    },
    cancelWallSplit: () => {
      if (get().tool === 'split-wall') set({ pendingSplitWallId: null, tool: 'select', error: null });
    },
    commitWallSplit: (point, scale) => {
      const state = get(); if (state.readOnly || !state.pendingSplitWallId) return false;
      const preview = resolveWallSplitPoint(state.document, state.pendingSplitWallId, point, scale);
      if (!preview?.valid) { set({ error: preview?.reason ?? 'Elige un punto sobre la pared seleccionada' }); return false; }
      try {
        state.apply(applyCommand(state.document, { type: 'split-wall', wallId: state.pendingSplitWallId,
          position: preview.position, vertexId: crypto.randomUUID(), newWallId: crypto.randomUUID() }));
        set({ pendingSplitWallId: null, tool: 'select' }); return true;
      } catch (error) { set({ error: error instanceof Error ? error.message : 'No se pudo añadir la esquina' }); return false; }
    },
    copyStair: (id) => {
      const state = get(), stair = state.document.stairs?.find((s) => s.id === id);
      if (state.readOnly || !stair) return;
      const copy = { ...structuredClone(stair), id: crypto.randomUUID(), x: stair.x + 300, y: stair.y + 300 };
      const candidate = upgradeSpatialDocument(addStair(state.document, copy));
      state.apply(placeNewObject(state.document, candidate, copy.id));
      set({ selection: [copy.id], pendingSplitWallId: null, pendingOpening: null, tool: 'select' });
    },
    copyOpening: (id) => {
      const state = get(), source = state.document.openings.find((o) => o.id === id);
      if (state.readOnly || !source) return;
      set({ pendingOpening: { ...structuredClone(source), id: crypto.randomUUID() }, pendingSplitWallId: null, selection: [], error: null,
        tool: source.kind === 'puerta' ? 'door' : source.kind === 'ventana' ? 'window' : 'passage' });
    },
    copySpatial: (id) => {
      const state = get(), item = findSpatialItem(state.document, id);
      if (state.readOnly || !item) return;
      set({ clipboardSpatial: structuredClone(item), error: null });
    },
    beginPasteSpatial: () => {
      const state = get();
      if (state.readOnly || !state.clipboardSpatial) return;
      set({ pendingSpatial: duplicateSpatialItem(state.clipboardSpatial), pendingOpening: null, pendingSplitWallId: null,
        selection: [], tool: 'place-object', error: null });
    },
    placePendingSpatial: (item) => {
      const state = get();
      if (state.readOnly || !state.pendingSpatial || state.tool !== 'place-object') return;
      try {
        state.apply(insertSpatialItem(state.document, item));
        set({ pendingSpatial: null, selection: [item.id], tool: 'select', error: null });
      } catch (error) { set({ error: error instanceof Error ? error.message : 'No se pudo colocar la copia.' }); }
    },
    cancelPendingSpatial: () => {
      if (get().tool === 'place-object') set({ pendingSpatial: null, tool: 'select', error: null });
    },
    apply: (candidate) => {
      if (get().readOnly) throw new Error('Este documento está en modo solo lectura');
      const state = get();
      const document = parseEditorDocument(reconcileCeilings(state.document, candidate));
      for (const light of document.luminaires ?? []) {
        const previous = state.document.luminaires?.find((item) => item.id === light.id);
        if (document.activeLevelId === state.document.activeLevelId && JSON.stringify(previous) !== JSON.stringify(light)) {
          const issue = luminairePlacementIssue(document, light);
          if (issue) throw new Error(issue);
        }
      }
      if (JSON.stringify(document) === JSON.stringify(state.document)) return;
      // Navigation compares the target level with itself, never with objects on another floor.
      const previousLevel = document.activeLevelId !== state.document.activeLevelId
        ? state.document.levels?.find((l) => l.id === document.activeLevelId)?.document ?? document : state.document;
      assertSpatialPlacement(previousLevel, document);
      set({ document, past: [...state.past, state.document].slice(-100), future: [],
        sequence: state.sequence + 1, error: null });
    },
    undo: () => {
      const state = get(), document = state.past.at(-1);
      if (state.readOnly || !document) return;
      set({ document, past: state.past.slice(0, -1), future: [state.document, ...state.future],
        sequence: state.sequence + 1, selection: [], pendingSplitWallId: null, tool: state.tool === 'split-wall' ? 'select' : state.tool, error: null });
    },
    redo: () => {
      const state = get(), document = state.future[0];
      if (state.readOnly || !document) return;
      set({ document, past: [...state.past, state.document], future: state.future.slice(1),
        sequence: state.sequence + 1, selection: [], pendingSplitWallId: null, tool: state.tool === 'split-wall' ? 'select' : state.tool, error: null });
    },
    select: (selection) => set({ selection }),
    setTool: (tool) => set({ tool, magneticGuides: [], pendingOpening: null, pendingSplitWallId: null, pendingSpatial: null, selection: [], error: null }),
    setSnap: (snap) => set({ snap }),
    setError: (error) => set({ error }),
    restore: (candidate) => set({ document: parseEditorDocument(candidate), past: [], future: [],
      sequence: 0, selection: [], pendingOpening: null, pendingSplitWallId: null, pendingSpatial: null, tool: 'select', error: null }),
  }));
}
export type EditorStore = ReturnType<typeof createEditorStore>;

export function resolveWallSplitPoint(doc: EditorDocument, wallId: string, pointer: Point, scale: number) {
  const wall = doc.walls.find((w) => w.id === wallId);
  if (!wall || !Number.isFinite(scale) || scale <= 0) return null;
  const [from, to] = wallPoints(doc, wall), path = wallPath(doc, wall), length = path.length;
  const position = path.project(pointer);
  const point = path.at(position);
  if (distance(pointer, point) * scale > 24 + wall.thicknessMm * scale / 2) return null;
  let reason: string | null = position * length < 50 || (1 - position) * length < 50 ? 'Aleja la esquina del extremo al menos 5 cm' : null;
  if (doc.openings.some((o) => o.wallId === wallId && Math.abs(position - o.position) * length < o.widthMm / 2 - 1e-7))
    reason = 'No se puede dividir a través de una abertura';
  return { point, from, to, position, valid: reason === null, reason };
}
