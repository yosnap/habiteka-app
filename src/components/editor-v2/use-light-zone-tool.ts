'use client';
import { useMemo, useState } from 'react';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { Point } from '@/lib/editor-document/schema';
import {
  LIGHT_ZONE_MODE_HINTS,
  addZoneRectangle,
  addZoneVertex,
  closeZonePart,
  draftBlocker,
  draftPolygons,
  emptyLightZoneDraft,
  toggleRoomPart,
  undoZoneVertex,
  type LightZoneDraft,
  type LightZoneStep,
} from '@/canvas/editor-v2/light-zone-draw';
import { planRegionAreas, roomAtPoint, uniqueRegionName } from '@/lib/editor-document/render-region-draw';
import { addLightZone, setLightZonePolygons } from '@/lib/editor-document/light-zone-commands';

/** Trazo de una zona de luces sobre el plano grande, listo para el lienzo. */
export interface LightZoneTool {
  active: boolean;
  draft: LightZoneDraft;
  cursor: Point | null;
  /** Contorno de la estancia bajo el cursor en modo estancia. */
  hovered: Point[] | null;
  rectangle: { start: Point; end: Point } | null;
  hint: string;
  canConfirm: boolean;
  pointerDown: (point: Point) => void;
  pointerMove: (point: Point) => void;
  pointerUp: () => void;
  /** Cierra el contorno punto a punto (doble clic o Intro). */
  close: () => void;
  /** Retira el último vértice marcado (Retroceso), sin tocar las partes cerradas. */
  undoVertex: () => void;
  /** Guarda la zona con lo marcado hasta ahora. */
  confirm: () => void;
}

/**
 * Herramienta `light-zone` del lienzo: el panel lateral encarga el trazo (modo y
 * si es un redibujo) y aquí se lleva el borrador hasta el comando. Al guardar se
 * vuelve a la herramienta de selección, como en el resto de altas del plano.
 */
export function useLightZoneTool(store: EditorStore): LightZoneTool {
  const errand = useStore(store, (state) => state.lightZoneDraw);
  const doc = useStore(store, (state) => state.document);
  const tool = useStore(store, (state) => state.tool);
  const active = tool === 'light-zone' && !!errand;
  const [handled, setHandled] = useState(errand);
  const [draft, setDraft] = useState<LightZoneDraft>(() => emptyLightZoneDraft(errand?.mode ?? 'room'));
  const [cursor, setCursor] = useState<Point | null>(null);
  const [rectangle, setRectangle] = useState<{ start: Point; end: Point } | null>(null);
  // Un encargo nuevo (o su cancelación) descarta el trazo anterior sin efectos.
  if (errand !== handled) {
    setHandled(errand);
    setDraft(emptyLightZoneDraft(errand?.mode ?? 'room'));
    setCursor(null);
    setRectangle(null);
  }
  const rooms = useMemo(() => planRegionAreas(doc), [doc]);

  const fail = (message: string) => store.getState().setError(message);
  const step = (result: LightZoneStep) => {
    setDraft(result.draft);
    if (result.error) fail(result.error);
    else if (result.done) save(result.draft);
  };
  const save = (candidate: LightZoneDraft) => {
    const blocker = draftBlocker(candidate);
    if (blocker) { fail(blocker); return; }
    const polygons = draftPolygons(candidate);
    const state = store.getState();
    try {
      if (errand?.zoneId) state.apply(setLightZonePolygons(state.document, errand.zoneId, polygons));
      else {
        const base = rooms.find((room) => room.roomId === candidate.parts[0]?.roomId)?.name ?? 'Zona de luces';
        const used = (state.document.lightZones ?? []).map((zone) => zone.name);
        state.apply(addLightZone(state.document, uniqueRegionName(base, used), polygons));
      }
      const saved = store.getState();
      saved.setTool('select');
      saved.setActiveLightZone(errand?.zoneId ?? saved.document.lightZones?.at(-1)?.id ?? null);
    } catch (error) {
      fail(error instanceof Error ? error.message : 'No se pudo guardar la zona de luces');
    }
  };

  return {
    active,
    draft,
    cursor,
    hovered: active && draft.mode === 'room' && cursor ? roomAtPoint(rooms, cursor)?.polygon ?? null : null,
    rectangle,
    hint: LIGHT_ZONE_MODE_HINTS[draft.mode],
    canConfirm: draft.parts.length > 0,
    pointerDown: (point) => {
      if (!active) return;
      if (draft.mode === 'rectangle') { setRectangle({ start: point, end: point }); return; }
      if (draft.mode === 'polygon') { step(addZoneVertex(draft, point)); return; }
      const room = roomAtPoint(rooms, point);
      if (!room) { fail('Pulsa dentro de una estancia cerrada, una escalera o una rampa del plano.'); return; }
      step(toggleRoomPart(draft, room));
    },
    pointerMove: (point) => {
      if (!active) return;
      setCursor(point);
      if (rectangle) setRectangle({ ...rectangle, end: point });
    },
    pointerUp: () => {
      if (!active || !rectangle) return;
      const gesture = rectangle;
      setRectangle(null);
      step(addZoneRectangle(draft, gesture.start, gesture.end));
    },
    close: () => {
      if (!active) return;
      if (draft.mode === 'polygon' && draft.vertices.length) step(closeZonePart(draft));
      else save(draft);
    },
    undoVertex: () => { if (active) setDraft(undoZoneVertex(draft)); },
    confirm: () => { if (active) save(draft); },
  };
}
