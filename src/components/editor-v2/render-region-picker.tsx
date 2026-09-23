'use client';

import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import type { RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import {
  MAX_REGIONS,
  REGION_MODES,
  REGION_MODE_HINTS,
  REGION_MODE_LABELS,
  closeDraftPolygon,
  closesOnFirstVertex,
  planRegionRooms,
  rectanglePolygon,
  roomAtPoint,
  uniqueRegionName,
  type RegionMode,
} from '@/lib/editor-document/render-region-draw';
import { snapWallPoint } from '@/canvas/editor-v2/snap-candidates';
import { RenderRegionMapLayers, planBounds } from './render-region-map';
import styles from './render-options-controls.module.css';

interface Props {
  document?: EditorDocument;
  regions: RenderDesignOptions['regions'];
  onChange: (regions: RenderDesignOptions['regions']) => void;
  disabled?: boolean;
}

/** Radio de cierre sobre el primer vértice y lado mínimo del rectángulo, en mm del plano. */
const CLOSE_RADIUS_MM = 400;
const MIN_RECTANGLE_SIDE_MM = 300;
const points = (polygon: readonly Point[]) =>
  polygon.map((point) => `${point.x},${point.y}`).join(' ');

/** Selector 2D: las zonas se guardan en milímetros del documento, nunca en píxeles de cámara. */
export function RenderRegionPicker({ document, regions, onChange, disabled }: Props) {
  const [mode, setMode] = useState<RegionMode>('room');
  const [name, setName] = useState('Zona permitida');
  const [rectangle, setRectangle] = useState<{ start: Point; end: Point } | null>(null);
  const [draft, setDraft] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const bounds = planBounds(document);
  const rooms = useMemo(() => planRegionRooms(document), [document]);
  const full = regions.length >= MAX_REGIONS;

  const pointFromEvent = (event: { clientX: number; clientY: number }): Point | null => {
    const svg = svgRef.current;
    if (!svg || !bounds) return null;
    const transform = svg.getScreenCTM();
    if (!transform) return null;
    const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse());
    return { x: local.x + bounds.minX, y: local.y + bounds.minY };
  };
  /** Escala en píxeles por milímetro: la que usa el magnetismo para medir su alcance. */
  const scale = () => {
    const width = svgRef.current?.getBoundingClientRect().width ?? 0;
    return bounds && width ? width / bounds.width : 0;
  };
  const snapped = (point: Point): Point =>
    document && mode === 'polygon' && scale()
      ? snapWallPoint(document, point, scale(), true).point
      : point;

  const addRegion = (polygon: Point[], label: string) => {
    if (full) return;
    setError(null);
    onChange([
      ...regions,
      {
        id: crypto.randomUUID(),
        name: uniqueRegionName(
          label,
          regions.map((region) => region.name),
        ),
        polygon,
      },
    ]);
  };
  const closeDraft = (vertices: readonly Point[] = draft) => {
    const closure = closeDraftPolygon(vertices);
    setDraft([]);
    setCursor(null);
    if (!closure.ok) {
      setError(
        closure.reason === 'pocos-vertices'
          ? 'Marca al menos tres vértices antes de cerrar la zona.'
          : 'El contorno se cruza consigo mismo: vuelve a marcarlo sin lazos.',
      );
      return;
    }
    addRegion(closure.polygon, name);
  };

  const pointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (disabled || full) return;
    const point = pointFromEvent(event);
    if (!point) return;
    if (mode === 'rectangle') {
      event.currentTarget.setPointerCapture(event.pointerId);
      setRectangle({ start: point, end: point });
      return;
    }
    if (mode === 'room') {
      const room = roomAtPoint(rooms, point);
      if (room) addRegion(room.polygon, room.name);
      else setError('Pulsa dentro de una estancia cerrada del plano.');
      return;
    }
    const vertex = snapped(point);
    if (closesOnFirstVertex(draft, vertex, CLOSE_RADIUS_MM)) closeDraft();
    else setDraft([...draft, vertex]);
  };
  const pointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = pointFromEvent(event);
    if (!point) return;
    if (rectangle) setRectangle({ ...rectangle, end: point });
    else if (mode !== 'rectangle') setCursor(mode === 'polygon' ? snapped(point) : point);
  };
  const pointerUp = () => {
    if (!rectangle) return;
    const polygon = rectanglePolygon(rectangle.start, rectangle.end, MIN_RECTANGLE_SIDE_MM);
    setRectangle(null);
    if (polygon) addRegion(polygon, name);
  };
  const keyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (mode !== 'polygon' || disabled) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      closeDraft();
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      setDraft(draft.slice(0, -1));
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setDraft([]);
      setCursor(null);
      setError(null);
    }
  };

  if (!bounds)
    return (
      <p className="text-muted-foreground rounded-control border border-line p-3 text-xs">
        Guarda un documento 2D válido para dibujar zonas con coordenadas reales.
      </p>
    );
  const hovered = mode === 'room' && cursor ? roomAtPoint(rooms, cursor) : null;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1" role="group" aria-label="Modo de marcado de zonas">
        {REGION_MODES.map((value) => (
          <button
            key={value}
            type="button"
            disabled={disabled}
            aria-pressed={mode === value}
            onClick={() => {
              setMode(value);
              setDraft([]);
              setCursor(null);
              setError(null);
            }}
            className={`${styles.optionButton} ${mode === value ? styles.active : ''}`}
          >
            {REGION_MODE_LABELS[value]}
          </button>
        ))}
      </div>
      {mode !== 'room' && (
        <input
          value={name}
          disabled={disabled}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-bwignore
          aria-label="Nombre de la nueva zona"
          className="border-line bg-surface w-full rounded-control border px-2 py-1.5 text-xs"
        />
      )}
      <p className="text-muted-foreground text-[11px]">
        {full ? `Máximo de ${MAX_REGIONS} zonas alcanzado.` : REGION_MODE_HINTS[mode]}
      </p>
      {error && <p className="text-destructive text-[11px]">{error}</p>}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${bounds.width} ${bounds.height}`}
        className={`${styles.map} border-line bg-canvas w-full rounded-control border`}
        role="img"
        tabIndex={0}
        aria-label="Mapa 2D del documento para seleccionar zonas permitidas"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerLeave={() => setCursor(null)}
        onPointerCancel={() => setRectangle(null)}
        onDoubleClick={() => mode === 'polygon' && closeDraft()}
        onKeyDown={keyDown}
      >
        <g transform={`translate(${-bounds.minX} ${-bounds.minY})`}>
          <RenderRegionMapLayers document={document} />
          {hovered && <polygon points={points(hovered.polygon)} className={styles.draft} />}
          {regions.map((region) => (
            <polygon key={region.id} points={points(region.polygon)} className={styles.selected} />
          ))}
          {draft.length > 0 && (
            <>
              <polyline
                points={points(cursor ? [...draft, cursor] : draft)}
                className={styles.draft}
                fill="none"
              />
              {draft.map((vertex, index) => (
                <circle
                  key={`${vertex.x}-${vertex.y}-${index}`}
                  cx={vertex.x}
                  cy={vertex.y}
                  r={index === 0 ? 160 : 110}
                  className={styles.selected}
                />
              ))}
            </>
          )}
          {rectangle && (
            <rect
              x={Math.min(rectangle.start.x, rectangle.end.x)}
              y={Math.min(rectangle.start.y, rectangle.end.y)}
              width={Math.abs(rectangle.end.x - rectangle.start.x)}
              height={Math.abs(rectangle.end.y - rectangle.start.y)}
              className={styles.draft}
            />
          )}
        </g>
      </svg>
      {regions.length > 0 && (
        <ul className="space-y-1" aria-label="Zonas permitidas marcadas">
          {regions.map((region) => (
            <li
              key={region.id}
              className="bg-canvas flex items-center gap-2 rounded-control px-2 py-1 text-xs"
            >
              <input
                value={region.name}
                disabled={disabled}
                maxLength={80}
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                data-bwignore
                aria-label={`Nombre de la zona ${region.name}`}
                onChange={(event) =>
                  onChange(
                    regions.map((item) =>
                      item.id === region.id
                        ? { ...item, name: event.target.value.slice(0, 80) || item.name }
                        : item,
                    ),
                  )
                }
                className="border-line bg-surface min-w-0 flex-1 rounded-control border px-2 py-1 text-xs"
              />
              <span className="text-muted-foreground">{region.polygon.length} vértices</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(regions.filter((item) => item.id !== region.id))}
                className="text-destructive underline-offset-2 hover:underline"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default RenderRegionPicker;
