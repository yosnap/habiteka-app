'use client';

/**
 * Menú flotante de acciones anclado SOBRE el objeto seleccionado (patrón Planner5D).
 * Aparece automáticamente al seleccionar uno o más objetos, sin necesidad de clic
 * derecho. Es un overlay HTML posicionado en píxeles de pantalla (relativos al
 * contenedor del canvas) — el stage calcula la posición desde el viewport.
 *
 * Reusa las MISMAS acciones del store que el menú de clic derecho (DRY): duplicar,
 * girar 90°, voltear y eliminar.
 */
import { useCanvasStore } from '@/canvas/canvas-store';

interface Props {
  /** Centro X del menú, en píxeles de pantalla relativos al contenedor del canvas. */
  x: number;
  /** Borde superior del menú, en píxeles de pantalla. */
  y: number;
  /** Ids de los objetos seleccionados sobre los que actúan los botones. */
  ids: string[];
}

interface Action {
  label: string;
  icon: React.ReactNode;
  run: () => void;
}

export function FloatingObjectMenu({ x, y, ids }: Props) {
  if (ids.length === 0) return null;
  const store = useCanvasStore.getState();

  const actions: Action[] = [
    {
      label: 'Duplicar',
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M4 16V6a2 2 0 0 1 2-2h10" />
        </svg>
      ),
      run: () => store.duplicateObjects(ids),
    },
    {
      label: 'Girar 90°',
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 3v5h-5" />
        </svg>
      ),
      run: () => store.rotate90(ids),
    },
    {
      label: 'Voltear',
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M12 3v18" />
          <path d="M8 7 4 12l4 5" />
          <path d="m16 7 4 5-4 5" />
        </svg>
      ),
      run: () => store.flipSelection(ids),
    },
    {
      label: 'Eliminar',
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M4 7h16" />
          <path d="M10 11v6M14 11v6" />
          <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
          <path d="M9 7V4h6v3" />
        </svg>
      ),
      run: () => store.removeObjects(ids),
    },
  ];

  return (
    <div
      className="border-line bg-surface/95 absolute z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-control border p-0.5 shadow-[var(--shadow-float)]"
      style={{ left: x, top: y }}
      // No deseleccionar al pulsar el menú.
      onPointerDown={(e) => e.stopPropagation()}
    >
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          title={a.label}
          aria-label={a.label}
          onClick={a.run}
          className="text-ink hover:bg-surface-muted flex h-7 w-7 items-center justify-center rounded-control"
        >
          {a.icon}
        </button>
      ))}
    </div>
  );
}
