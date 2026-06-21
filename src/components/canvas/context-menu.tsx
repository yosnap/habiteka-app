'use client';

/**
 * Menú contextual del lienzo (clic derecho). Muestra acciones sobre la selección:
 * copiar, cortar, pegar, duplicar, girar, voltear, traer al frente / enviar al
 * fondo y eliminar. Es un menú HTML flotante posicionado en el punto del clic.
 */
import { useMountEffect } from '@/lib/use-mount-effect';

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function CanvasContextMenu({ x, y, items, onClose }: Props) {
  // Cerrar al hacer clic fuera o pulsar Escape.
  useMountEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', onKey);
    };
  });

  return (
    <div
      className="border-line bg-surface fixed z-50 min-w-44 overflow-hidden rounded-[var(--radius-control)] border py-1 shadow-[var(--shadow-float)]"
      style={{ left: x, top: y }}
      // Evita que el pointerdown sobre el menú lo cierre antes del click.
      onPointerDown={(e) => e.stopPropagation()}
    >
      {items.map((item, i) =>
        item.label === '-' ? (
          <div key={`sep-${i}`} className="bg-line my-1 h-px" />
        ) : (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className="text-ink hover:bg-surface-muted block w-full px-3 py-1.5 text-left text-sm disabled:opacity-40"
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
