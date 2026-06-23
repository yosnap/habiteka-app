'use client';

import type { ReactNode } from 'react';
import type { SelectionMode } from './use-3d-selection';

export function ObjectFloatingMenu({
  mode,
  onMove,
  onRotate,
  onDuplicate,
  onDelete,
  onClose,
}: {
  mode: SelectionMode;
  onMove: () => void;
  onRotate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-lg bg-neutral-900/95 px-1.5 py-1 shadow-xl ring-1 ring-white/20"
      style={{ pointerEvents: 'all', whiteSpace: 'nowrap' }}
    >
      <Btn onClick={onMove} title="Mover" active={mode === 'translate'}>↔</Btn>
      <Btn onClick={onRotate} title="Rotar" active={mode === 'rotate'}>↺</Btn>
      <Divider />
      <Btn onClick={onDuplicate} title="Duplicar">⧉</Btn>
      <Btn onClick={onDelete} title="Eliminar" danger>✕</Btn>
      <Divider />
      <Btn onClick={onClose} title="Cerrar">×</Btn>
    </div>
  );
}

function Btn({
  onClick,
  title,
  active,
  danger,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className={[
        'rounded px-2 py-1 text-sm transition-colors',
        active ? 'bg-blue-600 text-white' : 'text-white hover:bg-white/10',
        danger ? 'text-red-400 hover:bg-red-900/30 hover:text-red-300' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-0.5 h-4 w-px shrink-0 bg-white/20" />;
}
