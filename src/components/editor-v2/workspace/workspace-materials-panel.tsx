'use client';

import { Paintbrush, Lightbulb, SlidersHorizontal } from 'lucide-react';
import ui from './workspace.module.css';

/** Accesos a los editores existentes: conservan todos sus acabados y controles. */
export function WorkspaceMaterialsPanel({
  onProperties,
  onCeiling,
  onPaint,
  hasSelection,
}: {
  onProperties: () => void;
  onCeiling: () => void;
  onPaint: () => void;
  hasSelection: boolean;
}) {
  return (
    <div className={ui.panelContent}>
      <p className={ui.eyebrow}>Materiales y ambiente</p>
      <p>Selecciona una estancia, pared o mueble para trabajar sobre sus acabados.</p>
      <div className={ui.actionCards}>
        <button type="button" disabled={!hasSelection} onClick={onPaint}>
          <Paintbrush size={20} aria-hidden="true" />
          <span>
            <strong>Apariencia de la selección</strong>
            <small>Colores, texturas y acabados disponibles</small>
          </span>
        </button>
        <button type="button" onClick={onProperties}>
          <SlidersHorizontal size={20} aria-hidden="true" />
          <span>
            <strong>Propiedades y suelo</strong>
            <small>Todos los controles del elemento o la estancia</small>
          </span>
        </button>
        <button type="button" onClick={onCeiling}>
          <Lightbulb size={20} aria-hidden="true" />
          <span>
            <strong>Techo y luces</strong>
            <small>Acabados de techo y luminarias</small>
          </span>
        </button>
      </div>
    </div>
  );
}
