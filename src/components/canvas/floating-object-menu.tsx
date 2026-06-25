'use client';

/**
 * Menú flotante de acciones anclado SOBRE el objeto seleccionado (patrón Planner5D).
 * Aparece automáticamente al seleccionar uno o más objetos, sin necesidad de clic
 * derecho. Es un overlay HTML posicionado en píxeles de pantalla (relativos al
 * contenedor del canvas) — el stage calcula la posición desde el viewport.
 *
 * Para muros (allWalls=true) muestra acciones específicas: color, ocultar y eliminar.
 * Para el resto muestra las acciones genéricas: duplicar, girar, voltear y eliminar.
 */
import { useRef } from 'react';
import { useCanvasStore } from '@/canvas/canvas-store';

interface Props {
  x: number;
  y: number;
  ids: string[];
  /** Todos los objetos seleccionados son muros. Cambia el conjunto de acciones. */
  allWalls?: boolean;
}

export function FloatingObjectMenu({ x, y, ids, allWalls }: Props) {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const store = useCanvasStore.getState();
  if (ids.length === 0) return null;

  if (allWalls) {
    const objects = store.doc.objects;
    const selectedWalls = objects.filter((o) => ids.includes(o.id));
    const anyHidden = selectedWalls.some((o) => o.hidden);
    const currentColor = selectedWalls[0]?.color ?? '#6b5a50';

    return (
      <div
        className="border-line bg-surface/95 absolute z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-control border p-0.5 shadow-[var(--shadow-float)]"
        style={{ left: x, top: y }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Color del muro */}
        <button
          type="button"
          title="Color del muro"
          aria-label="Color del muro"
          onClick={() => colorInputRef.current?.click()}
          className="text-ink hover:bg-surface-muted relative flex h-7 w-7 items-center justify-center rounded-control"
        >
          <span
            className="h-4 w-4 rounded-full border border-white/30"
            style={{ background: currentColor }}
          />
          <input
            ref={colorInputRef}
            type="color"
            defaultValue={currentColor}
            className="absolute inset-0 h-0 w-0 opacity-0"
            onChange={(e) => store.updateObjects(ids, { color: e.target.value })}
            aria-hidden
          />
        </button>

        {/* Ocultar / Mostrar */}
        <button
          type="button"
          title={anyHidden ? 'Mostrar muro' : 'Ocultar muro'}
          aria-label={anyHidden ? 'Mostrar muro' : 'Ocultar muro'}
          onClick={() => store.updateObjects(ids, { hidden: !anyHidden })}
          className="text-ink hover:bg-surface-muted flex h-7 w-7 items-center justify-center rounded-control"
        >
          {anyHidden ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          )}
        </button>

        {/* Eliminar */}
        <button
          type="button"
          title="Eliminar"
          aria-label="Eliminar"
          onClick={() => store.removeObjects(ids)}
          className="text-ink hover:bg-surface-muted flex h-7 w-7 items-center justify-center rounded-control"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 7h16" />
            <path d="M10 11v6M14 11v6" />
            <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
            <path d="M9 7V4h6v3" />
          </svg>
        </button>
      </div>
    );
  }

  // Acciones genéricas para mobiliario y otros objetos.
  return (
    <div
      className="border-line bg-surface/95 absolute z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-control border p-0.5 shadow-[var(--shadow-float)]"
      style={{ left: x, top: y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Duplicar */}
      <button
        type="button"
        title="Duplicar"
        aria-label="Duplicar"
        onClick={() => store.duplicateObjects(ids)}
        className="text-ink hover:bg-surface-muted flex h-7 w-7 items-center justify-center rounded-control"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M4 16V6a2 2 0 0 1 2-2h10" />
        </svg>
      </button>

      {/* Girar 90° */}
      <button
        type="button"
        title="Girar 90°"
        aria-label="Girar 90°"
        onClick={() => store.rotate90(ids)}
        className="text-ink hover:bg-surface-muted flex h-7 w-7 items-center justify-center rounded-control"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 3v5h-5" />
        </svg>
      </button>

      {/* Voltear */}
      <button
        type="button"
        title="Voltear"
        aria-label="Voltear"
        onClick={() => store.flipSelection(ids)}
        className="text-ink hover:bg-surface-muted flex h-7 w-7 items-center justify-center rounded-control"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M12 3v18" />
          <path d="M8 7 4 12l4 5" />
          <path d="m16 7 4 5-4 5" />
        </svg>
      </button>

      {/* Eliminar */}
      <button
        type="button"
        title="Eliminar"
        aria-label="Eliminar"
        onClick={() => store.removeObjects(ids)}
        className="text-ink hover:bg-surface-muted flex h-7 w-7 items-center justify-center rounded-control"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M4 7h16" />
          <path d="M10 11v6M14 11v6" />
          <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
          <path d="M9 7V4h6v3" />
        </svg>
      </button>
    </div>
  );
}
