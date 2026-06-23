'use client';

/**
 * Dibujo de muros como líneas rectas (F7.2/F7.3). Clic fija el inicio del segmento; al mover,
 * `preview` describe el muro en curso con snap a ángulo (0/45/90…); el siguiente clic confirma
 * el muro y deja su fin como inicio del próximo (encadenado). Esc/clic-derecho terminan la
 * cadena descartando solo el segmento en curso. Además se puede teclear la LONGITUD EXACTA del
 * muro en curso, que respeta la dirección con snap de ángulo.
 *
 * Usa coordenadas de MUNDO (`getRelativePointerPosition`, vía el `worldPointer` del stage),
 * NO las de pantalla de `getPointerPosition`: un muro se mide y va a 3D, así que necesita
 * coordenadas del documento que deshagan zoom/pan (red-team #2).
 */
import { useRef, useState, useCallback } from 'react';
import { useCanvasStore } from './canvas-store';
import { isValidScale, metersToPx } from './scale';
import type { CanvasScale } from './types';
import { segmentToWall, snapAngle, applyExactLength, type Point } from './draw-wall';
import { useValueChangeEffect } from '@/lib/use-value-change-effect';

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

/** Escala usable actual del doc (o null). */
function currentScale(): CanvasScale | null {
  const s = useCanvasStore.getState().doc.scale;
  return isValidScale(s) ? s! : null;
}

/**
 * Punto final ajustado con snap de ángulo (0/45/90…): mantiene los muros rectos sin
 * esfuerzo. El snap a rejilla NO se aplica aquí a propósito (vive en `grid-layer`, capa de
 * UI; meterlo cuantizaría longitudes y chocaría con la medida exacta tecleada — red-team #8).
 * El usuario puede alinear a rejilla moviendo el muro luego (snap on-drag ya existente).
 */
function resolveEnd(start: Point, raw: Point): Point {
  return snapAngle(start, raw);
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

  // Confirma un muro de `start.current` a `end` y encadena (el fin es el nuevo inicio).
  const commit = useCallback(
    (end: Point) => {
      if (!start.current) return;
      wallSeq += 1;
      const wall = segmentToWall(`wall-${wallSeq}`, start.current, end, currentScale());
      if (wall) addObject(wall);
      start.current = { x: end.x, y: end.y };
      setPreview({ start: end, end });
    },
    [addObject],
  );

  const onClick = useCallback(() => {
    if (!enabled) return;
    const pos = worldPointer();
    if (!pos) return;
    if (!start.current) {
      start.current = { x: pos.x, y: pos.y };
      setPreview({ start: pos, end: pos });
      return;
    }
    commit(resolveEnd(start.current, pos));
  }, [enabled, worldPointer, commit]);

  const onMove = useCallback(() => {
    if (!enabled || !start.current) return;
    const pos = worldPointer();
    if (!pos) return;
    setPreview({ start: start.current, end: resolveEnd(start.current, pos) });
  }, [enabled, worldPointer]);

  /**
   * Confirma el muro en curso con una LONGITUD EXACTA en metros (entrada tecleada), en la
   * dirección actual del preview. Ignora el snap a rejilla (la medida pedida manda).
   */
  const confirmWithLengthM = useCallback(
    (lengthM: number) => {
      if (!start.current || !preview || !Number.isFinite(lengthM) || lengthM <= 0) return;
      const scale = currentScale();
      const lengthPx = scale ? metersToPx(lengthM, scale) : lengthM;
      // Dirección con snap de ángulo (sin snap de rejilla, para no alterar la longitud).
      const dir = snapAngle(start.current, preview.end);
      commit(applyExactLength(start.current, dir, lengthPx));
    },
    [preview, commit],
  );

  // Al DESACTIVARSE la herramienta (cambio de tool), se descarta el muro en curso. Se
  // hace con el primitivo de cambio de valor (no un useEffect suelto en el componente).
  useValueChangeEffect(enabled, (active) => {
    if (!active) reset();
  });

  return {
    preview,
    handlers: { onClick, onMove },
    reset,
    confirmWithLengthM,
    // `preview` solo es no-null cuando hay un muro en curso (se setea junto al inicio y se
    // limpia en reset), así que basta para saber si se está dibujando — sin leer la ref.
    drawing: preview !== null,
  } as const;
}
