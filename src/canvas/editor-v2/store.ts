import type { MagneticGuide } from './magnetic-alignment';
import { createStore } from 'zustand/vanilla';
import type { EditorDocument, Opening, Point } from '@/lib/editor-document/schema';
import { reconcileCeilings } from '@/lib/editor-document/ceiling-reconciliation';
import { luminairePlacementIssue } from '@/lib/editor-document/ceiling-geometry';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { applyCommand } from '@/lib/editor-document/commands';
import { addStair } from '@/lib/editor-document/construction-commands';
import { distance, wallPoints } from '@/lib/editor-document/geometry';
import { assertSpatialPlacement, placeNewObject, relieveFurnitureForThickerWalls } from './spatial-placement';
import { upgradeSpatialDocument } from '@/lib/editor-document/spatial-properties';
import { wallPath } from '@/lib/editor-document/wall-path';
import { duplicateSpatialItem, findSpatialItem, insertSpatialItem, type SpatialClipboardItem } from './spatial-clipboard';
import { normalizeEditorDocument } from '@/lib/editor-document/document-normalization';
import { inheritFloorFinishes } from '@/lib/editor-document/floor-level';
import type { LightZoneMode } from './light-zone-draw';

/** Paneles que comparten la única ranura lateral del editor: solo uno abierto a la vez. */
export type EditorSidePanel = 'inspector' | 'catalog' | 'walkthrough' | 'context' | 'ceiling';

/**
 * Una selección normal solo actualiza el resumen: abrir Propiedades
 * automáticamente desplaza o tapa el plano al primer clic. El lateral se abre
 * a petición; una luz o un techo sí lleva a «Techo y luces».
 */
export function sidePanelForSelection(
  current: EditorSidePanel | null,
  options: { hasSelection: boolean; lighting: boolean },
): EditorSidePanel | null {
  // El inspector conserva el buscador al pulsar en un espacio vacío del lienzo.
  if (!options.hasSelection) return current;
  if (options.lighting) return 'ceiling';
  if (current === 'ceiling') return null;
  return current;
}

export type EditorTool = 'valla-madera' | 'cerca-metal' | 'seto' | 'patio' | 'kitchen' | 'select' | 'wall' | 'guard-wall' | 'rectangle' | 'door' | 'window' | 'passage' | 'measure' | 'split-wall' | 'place-object' | 'walkthrough' | 'light-strip' | 'light-zone';
export interface EditorState {
  detailAnchor: Point | null;
  setDetailAnchor: (point: Point) => void;
  magneticGuides: MagneticGuide[];
  setMagneticGuides: (guides: MagneticGuide[]) => void;
  /** Petición de centrar el lienzo en un punto; el nonce distingue peticiones repetidas al mismo sitio. */
  focusPoint: { point: Point; nonce: number } | null;
  focusOn: (point: Point) => void;
  /** Modo mano (desplazar el lienzo) y peticiones de vista (encuadrar, zoom) que el lienzo atiende una vez. */
  pan: boolean;
  setPan: (pan: boolean) => void;
  viewRequest: { kind: 'fit' | 'zoom-in' | 'zoom-out'; nonce: number } | null;
  requestView: (kind: 'fit' | 'zoom-in' | 'zoom-out') => void;
  walkthroughId: string | null;
  walkthroughFocusIndex: number | null;
  walkthroughPlaying: boolean;
  hideWalkthrough: () => void;
  setWalkthrough: (id: string | null) => void;
  focusWalkthroughSegment: (index: number | null) => void;
  setWalkthroughPlaying: (playing: boolean) => void;
  ceilingView: 'hidden' | 'transparent' | 'solid';
  setCeilingView: (view: 'hidden' | 'transparent' | 'solid') => void;
  /** Zona de luces en la que se está trabajando; es estado de sesión, no del documento. */
  activeLightZoneId: string | null;
  setActiveLightZone: (id: string | null) => void;
  /**
   * Encargo de dibujo de zona en curso: el panel elige modo y si se redibuja una
   * zona existente (`zoneId`), y el lienzo grande es quien traza. Vive mientras
   * la herramienta sea `light-zone`.
   */
  lightZoneDraw: { mode: LightZoneMode; zoneId: string | null } | null;
  beginLightZoneDraw: (mode: LightZoneMode, zoneId: string | null) => void;
  detailPanel: 'paint' | 'comments' | null;
  setDetailPanel: (panel: 'paint' | 'comments' | null) => void;
  /** Ranura lateral única: abrir un panel cierra el que hubiera. */
  sidePanel: EditorSidePanel | null;
  openSidePanel: (panel: EditorSidePanel) => void;
  closeSidePanel: () => void;
  toggleSidePanel: (panel: EditorSidePanel) => void;
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
  clipboardOpening: Opening | null;
  pendingSpatial: SpatialClipboardItem | null;
  copySpatial: (id: string) => void;
  beginPasteSpatial: () => void;
  /** Deja un elemento nuevo siguiendo al ratón para colocarlo con un clic (alta desde catálogo). */
  beginPlaceSpatial: (item: SpatialClipboardItem) => void;
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
    focusPoint: null, focusOn: (point) => set({ focusPoint: { point, nonce: (get().focusPoint?.nonce ?? 0) + 1 } }),
    pan: false, setPan: (pan) => set({ pan }),
    viewRequest: null, requestView: (kind) => set({ viewRequest: { kind, nonce: (get().viewRequest?.nonce ?? 0) + 1 } }),
    walkthroughId: null, walkthroughFocusIndex: null, walkthroughPlaying: false,
    hideWalkthrough: () => set({ walkthroughId: null, walkthroughFocusIndex: null, walkthroughPlaying: false, tool: 'select',
      sidePanel: get().sidePanel === 'walkthrough' ? null : get().sidePanel }),
    setWalkthrough: (walkthroughId) => set({ walkthroughId, walkthroughFocusIndex: null, walkthroughPlaying: false }),
    focusWalkthroughSegment: (walkthroughFocusIndex) => set({ walkthroughFocusIndex }),
    setWalkthroughPlaying: (walkthroughPlaying) => set({ walkthroughPlaying }),
    ceilingView: 'transparent',
    setCeilingView: (ceilingView) => set({ ceilingView }),
    activeLightZoneId: null,
    setActiveLightZone: (activeLightZoneId) => set({ activeLightZoneId }),
    lightZoneDraw: null,
    beginLightZoneDraw: (mode, zoneId) => {
      if (get().readOnly) return;
      get().setTool('light-zone');
      set({ lightZoneDraw: { mode, zoneId } });
    },
    detailPanel: null,
    setDetailPanel: (detailPanel) => set({ detailPanel, ...(detailPanel && get().sidePanel !== 'ceiling' ? { sidePanel: 'inspector' as const } : {}) }),
    sidePanel: null,
    openSidePanel: (sidePanel) => set({ sidePanel, detailPanel: null }),
    closeSidePanel: () => set({ sidePanel: null, detailPanel: null }),
    toggleSidePanel: (panel) => set({ sidePanel: get().sidePanel === panel ? null : panel, detailPanel: null }),
    readOnly: options.readOnly ?? false,
    // Al cargar se sanea sin contar como edición: no se guarda hasta que el usuario cambie algo.
    document: parseEditorDocument(normalizeEditorDocument(parseEditorDocument(initial), { onLoad: true })), past: [], future: [], selection: [],
    tool: 'select', pendingOpening: null, pendingSplitWallId: null, clipboardSpatial: null, clipboardOpening: null, pendingSpatial: null, snap: true, sequence: 0, error: null,
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
      if (state.readOnly) return;
      const opening = state.document.openings.find(entry => entry.id === id);
      if (opening) { set({ clipboardOpening: structuredClone(opening), clipboardSpatial: null, error: null }); return; }
      if (!item) return;
      set({ clipboardSpatial: structuredClone(item), clipboardOpening: null, error: null });
    },
    beginPasteSpatial: () => {
      const state = get();
      if (state.readOnly) return;
      if (state.clipboardOpening) {
        const opening = { ...structuredClone(state.clipboardOpening), id: crypto.randomUUID() };
        set({ pendingOpening: opening, pendingSpatial: null, pendingSplitWallId: null, selection: [], pan: false,
          tool: opening.kind === 'puerta' ? 'door' : opening.kind === 'ventana' ? 'window' : 'passage', error: null });
        return;
      }
      if (!state.clipboardSpatial) return;
      state.beginPlaceSpatial(duplicateSpatialItem(state.clipboardSpatial));
    },
    beginPlaceSpatial: (item) => {
      if (get().readOnly) return;
      set({ pendingSpatial: item, pendingOpening: null, pendingSplitWallId: null, selection: [], tool: 'place-object', pan: false, error: null });
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
      // Los restos invisibles de contornos de patio anteriores se retiran en cada edición: parten estancias y bloquean suelos.
      let document = parseEditorDocument(normalizeEditorDocument(inheritFloorFinishes(state.document, reconcileCeilings(state.document, candidate))));
      if (document.activeLevelId === state.document.activeLevelId)
        document = relieveFurnitureForThickerWalls(state.document, document);
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
      set({ document, past: state.past.slice(0, -1), future: [state.document, ...state.future], sidePanel: sidePanelForSelection(state.sidePanel, { hasSelection: false, lighting: false }),
        sequence: state.sequence + 1, selection: [], pendingSplitWallId: null, tool: state.tool === 'split-wall' ? 'select' : state.tool, error: null });
    },
    redo: () => {
      const state = get(), document = state.future[0];
      if (state.readOnly || !document) return;
      set({ document, past: [...state.past, state.document], future: state.future.slice(1), sidePanel: sidePanelForSelection(state.sidePanel, { hasSelection: false, lighting: false }),
        sequence: state.sequence + 1, selection: [], pendingSplitWallId: null, tool: state.tool === 'split-wall' ? 'select' : state.tool, error: null });
    },
    select: (selection) => {
      const state = get(), document = state.document;
      const lighting = selection.length > 0 && selection.some((id) =>
        (document.luminaires?.some((light) => light.id === id) ?? false)
        || (document.ceilings?.some((ceiling) => ceiling.id === id) ?? false));
      set({ selection, detailPanel: null, sidePanel: sidePanelForSelection(state.sidePanel, { hasSelection: selection.length > 0, lighting }) });
    },
    // Cambiar de herramienta deja la ranura como estaba salvo Propiedades, que se
    // queda sin selección que mostrar; «Techo y luces» sigue abierto porque es
    // quien lanza el dibujo de una tira LED o de una zona.
    setTool: (tool) => set({ lightZoneDraw: null, sidePanel: get().sidePanel === 'inspector' ? null : get().sidePanel, tool, magneticGuides: [], pendingOpening: null, pendingSplitWallId: null, pendingSpatial: null, selection: [], error: null }),
    setSnap: (snap) => set({ snap }),
    setError: (error) => set({ error }),
    restore: (candidate) => set({ sidePanel: null, lightZoneDraw: null, activeLightZoneId: null, document: parseEditorDocument(normalizeEditorDocument(parseEditorDocument(candidate), { onLoad: true })), past: [], future: [],
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
