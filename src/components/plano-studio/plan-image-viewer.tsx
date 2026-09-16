'use client';

/**
 * Visor de una imagen de plano (original, redibujado, SVG extraído o cenital)
 * con la misma navegación que el lienzo del editor: rueda para acercar y
 * alejar sobre el puntero, barra abajo a la izquierda con −/+, «Encuadrar» y
 * «Mano» para arrastrar. Al cargar la imagen o cambiar el tamaño del hueco se
 * encuadra entera: nunca hay scroll de página por culpa del plano.
 */
import { useCallback, useRef, useState, type PointerEvent, type ReactNode } from 'react';

interface Props {
  src: string;
  alt: string;
  /** Leyenda que se muestra sobre la esquina inferior derecha. */
  caption?: ReactNode;
}

interface View {
  scale: number;
  x: number;
  y: number;
  /** Escala del encuadre: referencia del porcentaje mostrado y de los límites de zoom. */
  fit: number;
}

// Margen (px) alrededor del plano al encuadrar.
const FIT_PADDING = 24;
// Zoom relativo al encuadre: entre un cuarto y ocho veces.
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;

export function PlanImageViewer({ src, alt, caption }: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0, fit: 1 });
  const [pan, setPan] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Lee el tamaño natural del <img> en el momento de encuadrar: si la imagen
  // venía de caché, `onLoad` pudo dispararse antes de hidratar y no llegar.
  const fit = useCallback(() => {
    const el = container.current;
    const img = image.current;
    const w = img?.naturalWidth ?? 0;
    const h = img?.naturalHeight ?? 0;
    if (!el || !img?.complete || w === 0 || h === 0) return;
    // Un scroll programático (p. ej. de una herramienta de accesibilidad) no debe descuadrar.
    el.scrollTop = 0;
    el.scrollLeft = 0;
    const scale = Math.max(
      0.01,
      Math.min((el.clientWidth - FIT_PADDING * 2) / w, (el.clientHeight - FIT_PADDING * 2) / h),
    );
    setView({ scale, x: (el.clientWidth - w * scale) / 2, y: (el.clientHeight - h * scale) / 2, fit: scale });
  }, []);

  /** Zoom multiplicativo manteniendo fijo el punto `at` (coordenadas del hueco). */
  const zoom = useCallback((factor: number, at?: { x: number; y: number }) => {
    const el = container.current;
    if (!el) return;
    const point = at ?? { x: el.clientWidth / 2, y: el.clientHeight / 2 };
    setView((v) => {
      const scale = Math.min(Math.max(v.scale * factor, v.fit * MIN_ZOOM), v.fit * MAX_ZOOM);
      const k = scale / v.scale;
      return { ...v, scale, x: point.x - (point.x - v.x) * k, y: point.y - (point.y - v.y) * k };
    });
  }, []);

  // Ref con limpieza: la rueda necesita un listener NO pasivo (React registra
  // onWheel pasivo y no deja anular el scroll) y el hueco se reencuadra al
  // cambiar de tamaño.
  const setContainer = useCallback(
    (el: HTMLDivElement | null) => {
      container.current = el;
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        zoom(e.deltaY > 0 ? 0.9 : 1.1, { x: e.clientX - rect.left, y: e.clientY - rect.top });
      };
      el.addEventListener('wheel', onWheel, { passive: false });
      const observer = new ResizeObserver(() => fit());
      observer.observe(el);
      return () => {
        el.removeEventListener('wheel', onWheel);
        observer.disconnect();
      };
    },
    [fit, zoom],
  );

  // Ref estable del <img>: un callback nuevo por render se re-adjuntaría en
  // cada commit y volvería a encuadrar (bucle de actualizaciones). Sólo se
  // encuadra al montar si la imagen ya estaba cargada (caché, antes de onLoad).
  const setImage = useCallback(
    (img: HTMLImageElement | null) => {
      image.current = img;
      if (img?.complete && img.naturalWidth > 0) fit();
    },
    [fit],
  );

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!pan || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y };
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    setView((v) => ({ ...v, x: d.vx + (e.clientX - d.px), y: d.vy + (e.clientY - d.py) }));
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const percent = Math.round((view.scale / view.fit) * 100);
  const buttonClass = 'text-ink hover:bg-muted rounded px-2 py-1 text-xs';

  return (
    <div
      ref={setContainer}
      className="relative h-full w-full select-none overflow-hidden bg-white"
      style={{ cursor: pan ? (dragging ? 'grabbing' : 'grab') : 'default', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- imagen generada o subida (URL firmada o data URL). */}
      <img
        ref={setImage}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={fit}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          maxWidth: 'none',
          transformOrigin: '0 0',
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          pointerEvents: 'none',
        }}
      />
      {caption ? (
        <div className="text-ink-soft absolute bottom-3 right-3 max-w-[55%] rounded bg-white/90 px-2 py-1 text-xs">
          {caption}
        </div>
      ) : null}
      <div
        className="border-line bg-surface absolute bottom-3 left-3 flex items-center gap-1 rounded-control border p-1"
        aria-label="Navegación del plano"
      >
        <button type="button" className={buttonClass} aria-label="Alejar" onClick={() => zoom(0.8)}>
          −
        </button>
        <span className="text-ink-soft min-w-12 text-center text-xs tabular-nums">{percent} %</span>
        <button type="button" className={buttonClass} aria-label="Acercar" onClick={() => zoom(1.25)}>
          +
        </button>
        <button type="button" className={buttonClass} onClick={fit}>
          Encuadrar
        </button>
        <button
          type="button"
          className={`${buttonClass} ${pan ? 'bg-muted font-medium' : ''}`}
          aria-pressed={pan}
          onClick={() => setPan((p) => !p)}
        >
          Mano
        </button>
      </div>
    </div>
  );
}
