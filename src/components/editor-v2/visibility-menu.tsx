'use client';

import { Eye, EyeOff } from 'lucide-react';
import { HeaderMenu } from './header-menu';
import styles from './visibility-menu.module.css';
import { CheckToggle } from '@/components/ui/check-toggle';
import { ModernSelect } from '@/components/ui/modern-select';
import { EDITOR_SHORTCUTS } from '@/canvas/editor-v2/editor-shortcuts';

export type DimensionVisibility = 'all' | 'external' | 'none';

export interface EditorVisibility {
  dimensions: DimensionVisibility;
  furniture: boolean;
  walls: boolean;
  /** Símbolos de luces y contornos de techo en el plano; molestan al dibujar muros. */
  lighting: boolean;
}

interface VisibilityMenuProps {
  value: EditorVisibility;
  onChange: (next: EditorVisibility) => void;
  shortcutsEnabled: boolean;
  onShortcutsChange: (enabled: boolean) => void;
}

const SHORTCUT_SUMMARY = [['select', 'seleccionar'], ['construct', 'construir'], ['furnish', 'amueblar'], ['measure', 'medir'], ['wall', 'pared'],
  ['rectangle', 'habitación'], ['door', 'puerta'], ['window', 'ventana'], ['passage', 'hueco'], ['pan', 'mano'], ['fit', 'encuadrar']] as const;

export function VisibilityMenu({ value, onChange, shortcutsEnabled, onShortcutsChange }: VisibilityMenuProps) {
  const patch = (next: Partial<EditorVisibility>) => onChange({ ...value, ...next });
  const eye = (visible: boolean) => visible ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />;
  return <HeaderMenu icon={<Eye size={18} aria-hidden="true" />} label="Vista" ariaLabel="Opciones de visualización y atajos">
    <fieldset>
      <legend>Mostrar</legend>
      <CheckToggle ariaLabel="Mostrar paredes" checked={value.walls} onChange={(walls) => patch({ walls })} label={<>{eye(value.walls)} Paredes</>} />
      <CheckToggle ariaLabel="Mostrar muebles" checked={value.furniture} onChange={(furniture) => patch({ furniture })} label={<>{eye(value.furniture)} Muebles</>} />
      <CheckToggle ariaLabel="Mostrar iluminación" checked={value.lighting} onChange={(lighting) => patch({ lighting })} label={<>{eye(value.lighting)} Iluminación</>} />
      <label className={styles.field}><span>Medidas</span><ModernSelect aria-label="Visibilidad de medidas" value={value.dimensions} onChange={(event) => patch({ dimensions: event.target.value as DimensionVisibility })}>
        <option value="all">Todas</option><option value="external">Solo exteriores</option><option value="none">Ocultas</option>
      </ModernSelect></label>
    </fieldset>
    <fieldset>
      <legend>Atajos de teclado</legend>
      <CheckToggle ariaLabel="Activar atajos de teclado" checked={shortcutsEnabled} onChange={onShortcutsChange} label="Activar atajos" />
      <p>{SHORTCUT_SUMMARY.map(([id, text]) => `${EDITOR_SHORTCUTS[id].label} ${text}`).join(' · ')} · Esc cancelar</p>
    </fieldset>
  </HeaderMenu>;
}
