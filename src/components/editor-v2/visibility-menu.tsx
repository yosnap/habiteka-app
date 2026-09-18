'use client';

import { Eye, EyeOff, SlidersHorizontal } from 'lucide-react';
import styles from './visibility-menu.module.css';

export type DimensionVisibility = 'all' | 'external' | 'none';

export interface EditorVisibility {
  dimensions: DimensionVisibility;
  furniture: boolean;
  walls: boolean;
}

interface VisibilityMenuProps {
  value: EditorVisibility;
  onChange: (next: EditorVisibility) => void;
  shortcutsEnabled: boolean;
  onShortcutsChange: (enabled: boolean) => void;
}

export function VisibilityMenu({ value, onChange, shortcutsEnabled, onShortcutsChange }: VisibilityMenuProps) {
  const patch = (next: Partial<EditorVisibility>) => onChange({ ...value, ...next });
  return <details className={styles.menu}>
    <summary aria-label="Opciones de visualización y atajos"><SlidersHorizontal size={13} aria-hidden="true" /><span>Vista</span></summary>
    <div className={styles.popover} role="dialog" aria-label="Opciones de visualización y atajos">
      <fieldset>
        <legend>Mostrar</legend>
        <label><input aria-label="Mostrar paredes" type="checkbox" checked={value.walls} onChange={(event) => patch({ walls: event.target.checked })} />
          {value.walls ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />} Paredes</label>
        <label><input aria-label="Mostrar muebles" type="checkbox" checked={value.furniture} onChange={(event) => patch({ furniture: event.target.checked })} />
          {value.furniture ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />} Muebles</label>
        <label><span>Medidas</span><select aria-label="Visibilidad de medidas" value={value.dimensions} onChange={(event) => patch({ dimensions: event.target.value as DimensionVisibility })}>
          <option value="all">Todas</option><option value="external">Solo exteriores</option><option value="none">Ocultas</option>
        </select></label>
      </fieldset>
      <fieldset>
        <legend>Atajos de teclado</legend>
        <label><input aria-label="Activar atajos de teclado" type="checkbox" checked={shortcutsEnabled} onChange={(event) => onShortcutsChange(event.target.checked)} /> Activar atajos</label>
        <p>S seleccionar · B pared · R habitación · D puerta · V ventana · H hueco · F muebles · M medir · Esc cancelar</p>
      </fieldset>
    </div>
  </details>;
}
