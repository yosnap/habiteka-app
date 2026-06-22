'use client';

/**
 * Dibujo de muros como líneas rectas (F7.2). Clic fija el inicio del segmento; al mover,
 * `preview` describe el muro en curso (para pintar la línea + su cota en vivo); el siguiente
 * clic confirma el muro y deja su fin como inicio del próximo (encadenado). Esc/clic-derecho
 * terminan la cadena descartando solo el segmento en curso.
 *
 * Usa coordenadas de MUNDO (`getRelativePointerPosition`, vía el `worldPointer` del stage),
 * NO las de pantalla de `getPointerPosition`: un muro se mide y va a 3D, así que necesita
 * coordenadas del documento que deshagan zoom/pan (red-team #2).
 */
import { useRef, useState, useCallback } from 'react';
import { useCanvasStore } from './canvas-store';
import { isValidScale } from './scale';
import { segmentToWall, type Point } from './draw-wall';

let wallSeq = 0;

/** Muro en curso para previsualizar (puntos en coordenadas de mundo). */
export interface DrawWallPreview {
  start: Point;
  end: Point;
}

export interface UseDrawWallOptions {
  enabled: boolean;
  /** Devuelve la posición del cursor en coordenadas de mundo (o null). */
  worldPointer: () => Point | null;
}

export function useDrawWall({ enabled, worldPointer }: UseDrawWallOptions) {
  const addObject = useCanvasStore((s) => s.addObject);
  // Punto de inicio del segmento actual (null = aún no se ha empezado / cadena terminada).
  const start = useRef<Point | null>(null);
  const [preview, setPreview] = useState<DrawWallPreview | null>(null);

  const reset = useCallback(() => {
    start.current = null;
    setPreview(null);
  }, []);

  const onClick = useCallback(() => {
    if (!enabled) return;
    const pos = worldPointer();
    if (!pos) return;
    if (!start.current) {
      // Primer clic: fija el inicio.
      start.current = { x: pos.x, y: pos.y };
      setPreview({ start: pos, end: pos });
      return;
    }
    // Segundo clic: confirma el muro (si no es degenerado) y encadena.
    const scale = isValidScale(useCanvasStore.getState().doc.scale)
      ? useCanvasStore.getState().doc.scale!
      : null;
    wallSeq += 1;
    const wall = segmentToWall(`wall-${wallSeq}`, start.current, pos, scale);
    if (wall) addObject(wall);
    // El fin queda como inicio del siguiente (encadenado).
    start.current = { x: pos.x, y: pos.y };
    setPreview({ start: pos, end: pos });
  }, [enabled, worldPointer, addObject]);

  const onMove = useCallback(() => {
    if (!enabled || !start.current) return;
    const pos = worldPointer();
    if (!pos) return;
    setPreview({ start: start.current, end: pos });
  }, [enabled, worldPointer]);

  return { preview, handlers: { onClick, onMove }, reset } as const;
}
