'use client';
import { ModernSelect } from '@/components/ui/modern-select';
import { useState } from 'react';
import { DEFAULT_NAME_STYLE, type NameLabelStyle } from '@/canvas/editor-v2/workspace-display';
import { nameLabelCss } from './name-label-style';
import ui from './workspace-scene-options.module.css';

export function WorkspaceLabelOptions({ value, onChange, disabled }: {
  value: NameLabelStyle; onChange: (value: NameLabelStyle) => void; disabled: boolean;
}) {
  const patch = (next: Partial<NameLabelStyle>) => onChange({ ...value, ...next });
  const [container, setContainer] = useState<HTMLFieldSetElement | null>(null);
  return <fieldset ref={setContainer} className={ui.labelFormat} disabled={disabled}>
    <legend>Formato de nombres · todas las vistas</legend>
    <div className={ui.labelPreview}><span style={nameLabelCss(value)}>Salón</span></div>
    <label className={ui.fontField}>Fuente<ModernSelect appearance="editor" aria-label="Fuente de los nombres" value={value.font} portalContainer={container}
      disabled={disabled} onChange={event => patch({ font: event.target.value as NameLabelStyle['font'] })}>
      <option value="sans">Sans serif</option><option value="serif">Serif</option><option value="mono">Monoespaciada</option>
    </ModernSelect></label>
    <label>Tamaño<input aria-label="Tamaño de los nombres" type="range" min={9} max={24} value={value.size}
      onChange={event => patch({ size: Number(event.target.value) })} /><output>{value.size} px</output></label>
    <label>Negrita<input type="checkbox" checked={value.bold} onChange={event => patch({ bold: event.target.checked })} /></label>
    <label>Color del texto<input aria-label="Color del texto de los nombres" type="color" value={value.color}
      onChange={event => patch({ color: event.target.value })} /></label>
    <label>Mostrar fondo<input type="checkbox" checked={value.backgroundVisible} onChange={event => patch({ backgroundVisible: event.target.checked })} /></label>
    <label>Color del fondo<input aria-label="Color del fondo de los nombres" type="color" value={value.background}
      disabled={!value.backgroundVisible || disabled} onChange={event => patch({ background: event.target.value })} /></label>
    <label>Redondeado<input aria-label="Redondeado del fondo de los nombres" type="range" min={0} max={24} value={value.radius}
      onChange={event => patch({ radius: Number(event.target.value) })} /><output>{value.radius} px</output></label>
    <button type="button" className={ui.reset} onClick={() => onChange(DEFAULT_NAME_STYLE)}>Restablecer formato</button>
  </fieldset>;
}
