'use client';
import { useRef, useState } from 'react';
import { FileImage, Check } from 'lucide-react';
import type { PlanReference } from '@/lib/editor-document/plan-reference';
import { ReferenceBackgroundPicker } from '../reference-background-picker';
import ui from './workspace-reference-menu.module.css';

export function WorkspaceReferenceMenu({ reference, visible, opacity, onVisible, onOpacity }: {
  reference: PlanReference; visible: boolean; opacity: number; onVisible: (value: boolean) => void; onOpacity: (value: number) => void;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return <details ref={menu} className={ui.root} data-workspace-reference
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); if (menu.current) menu.current.open = false; menu.current?.querySelector('summary')?.focus(); } }}>
    <summary aria-label="Mostrar original y elegir fondo" title="Mostrar original y elegir fondo">
      <FileImage size={18} aria-hidden="true" /><span>Mostrar original</span>
    </summary>
    <div ref={setContainer} className={ui.menu}>
      <button type="button" aria-pressed={visible} onClick={() => onVisible(!visible)}>
        <span>Mostrar original</span>{visible && <Check size={17} aria-hidden="true" />}
      </button>
      <label>Opacidad del fondo<output>{Math.round(opacity * 100)} %</output>
        <input type="range" aria-label="Opacidad del plano original" min={20} max={100} value={Math.round(opacity * 100)}
          disabled={!visible} onChange={event => onOpacity(Number(event.target.value) / 100)} />
      </label>
      {reference.choices && <div className={ui.picker}><p>Imagen de fondo</p>
        <ReferenceBackgroundPicker choices={reference.choices} portalContainer={container} />
      </div>}
    </div>
  </details>;
}
