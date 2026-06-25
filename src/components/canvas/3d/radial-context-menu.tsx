'use client';

/**
 * Menú contextual RADIAL (corona de botones) sobre el objeto seleccionado en 3D,
 * estilo Planner5D. Se monta dentro de un `<Html>` (drei) que lo ancla a la posición
 * 3D del objeto y lo sigue al moverse; este componente solo dibuja la corona.
 *
 * Botones disponibles según lo que el caller pase: Mover, Rotar, Cambiar tipo (si onSwap),
 * Duplicar, Eliminar, Cerrar. El contenedor tiene `pointerEvents:'none'` y solo los botones
 * capturan el puntero, para no bloquear OrbitControls en los huecos.
 */
import type { SelectionMode } from './use-3d-selection';

interface RadialItem {
  angle: number; // grados desde arriba, horario
  icon: string;
  title: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}

/** Radio de la corona (px) desde el centro al centro de cada botón. */
const RADIUS = 52;

export function RadialContextMenu({
  mode,
  onMove,
  onRotate,
  onDuplicate,
  onDelete,
  onClose,
  onSwap,
}: {
  mode: SelectionMode;
  onMove: () => void;
  onRotate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
  onSwap?: () => void;
}) {
  const items: RadialItem[] = [
    { angle: 0, icon: '↕', title: 'Mover', onClick: onMove, active: mode === 'translate' },
    { angle: 60, icon: '↺', title: 'Rotar', onClick: onRotate, active: mode === 'rotate' },
    ...(onSwap
      ? [{ angle: 300, icon: '⇄', title: 'Cambiar tipo', onClick: onSwap }]
      : []),
    { angle: 120, icon: '⧉', title: 'Duplicar', onClick: onDuplicate },
    { angle: 180, icon: '🗑', title: 'Eliminar', onClick: onDelete, danger: true },
    { angle: 240, icon: '×', title: 'Cerrar', onClick: onClose },
  ];

  return (
    <div
      style={{
        position: 'relative',
        width: 140,
        height: 140,
        pointerEvents: 'none',
      }}
    >
      {/* Punto central que marca el objeto anclado */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 6,
          height: 6,
          transform: 'translate(-50%, -50%)',
          borderRadius: 9999,
          background: '#2196f3',
          boxShadow: '0 0 0 3px rgba(33,150,243,0.25)',
        }}
      />
      {items.map((it) => {
        const rad = (it.angle * Math.PI) / 180;
        const x = RADIUS * Math.sin(rad);
        const y = -RADIUS * Math.cos(rad);
        return (
          <button
            key={it.title}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              it.onClick();
            }}
            title={it.title}
            aria-label={it.title}
            className={[
              'absolute flex h-9 w-9 items-center justify-center rounded-full text-sm shadow-lg ring-1 transition-colors',
              'bg-neutral-900/95 ring-white/20',
              it.active
                ? 'bg-blue-600 text-white ring-blue-300'
                : it.danger
                  ? 'text-red-400 hover:bg-red-900/40 hover:text-red-300'
                  : 'text-white hover:bg-white/15',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'all',
            }}
          >
            {it.icon}
          </button>
        );
      })}
    </div>
  );
}
