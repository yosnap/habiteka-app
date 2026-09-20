'use client';
import { type LucideIcon } from 'lucide-react';
import type { Point } from '@/lib/editor-document/schema';
import styles from './editor.module.css';

export interface SelectionContextAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}
export interface SelectionContextMenuProps {
  /** Canvas owner resolves the selection to screen coordinates and clamps this anchor. */
  anchor: Point;
  label: string;
  actions: SelectionContextAction[];
  onClose: () => void;
}

/** Presentational only: selection, commands and gesture state stay with the canvas owner. */
export function SelectionContextMenu({ anchor, label, actions, onClose }: SelectionContextMenuProps) {
  return <div className={styles.contextMenu} role="toolbar" aria-label={`Acciones de ${label}`}
    style={{ left: anchor.x, top: anchor.y }} onPointerDown={(event) => event.stopPropagation()}
    onKeyDown={(event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const current = buttons.indexOf(event.target as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : (current + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
      event.preventDefault(); buttons[next]?.focus();
    }}>
    {actions.map(({ id, label: actionLabel, icon: Icon, onSelect, disabled, danger }, index) => {
      const angle = 2 * Math.PI * index / actions.length - Math.PI / 2;
      return <button type="button" key={id} className={styles.contextAction} data-danger={danger || undefined}
        style={{ left: `calc(50% + ${Math.cos(angle) * 88}px)`, top: `calc(50% + ${Math.sin(angle) * 88}px)` }}
        aria-label={actionLabel} title={actionLabel} disabled={disabled} onClick={onSelect}>
        <Icon size={20} aria-hidden="true" /><span>{actionLabel}</span>
      </button>;
    })}

  </div>;
}
