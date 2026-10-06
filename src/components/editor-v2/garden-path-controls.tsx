'use client';
import { useState } from 'react';
import { DEFAULT_GARDEN_PATH, GARDEN_PATH_MATERIALS, type GardenPathOptions } from '@/lib/editor-document/garden-paths';
import { ModernSelect } from '@/components/ui/modern-select';
import ui from './construction-menu.module.css';

export function GardenPathControls({ disabled, onStart }: { disabled: boolean; onStart: (options: GardenPathOptions) => void }) {
  const [options, setOptions] = useState(DEFAULT_GARDEN_PATH);
  return <details className={ui.gardenSection}><summary>Caminos · acabado, ancho y plantas</summary>
    <p>Primer clic: inicio. Cada clic añade un tramo. Escape termina. Los tramos y las plantas se pueden editar por separado.</p>
    <label>Acabado<ModernSelect value={options.material} onChange={(e) => setOptions({ ...options, material: e.target.value as GardenPathOptions['material'] })}>
      {Object.entries(GARDEN_PATH_MATERIALS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </ModernSelect></label>
    <label>Ancho (m)<input type="number" min={.3} max={10} step={.1} value={options.widthMm/1000}
      onChange={(e) => setOptions({ ...options, widthMm: Number(e.target.value)*1000 })} /></label>
    <label>Vegetación lateral<ModernSelect value={options.border} onChange={(e) => setOptions({ ...options, border: e.target.value as GardenPathOptions['border'] })}>
      <option value="none">Sin vegetación</option><option value="left">Izquierda</option><option value="right">Derecha</option><option value="both">Ambos lados</option>
    </ModernSelect></label>
    <label>Plantas<ModernSelect value={options.planting} onChange={(e) => setOptions({ ...options, planting: e.target.value as GardenPathOptions['planting'] })}>
      <option value="arbusto">Arbustos</option><option value="planta-exterior">Formios</option>
    </ModernSelect></label>
    <label><input type="checkbox" checked={options.curb} onChange={(e) => setOptions({ ...options, curb: e.target.checked })} />Bordillos a ambos lados</label>
    <button type="button" disabled={disabled || !Number.isFinite(options.widthMm) || options.widthMm < 300 || options.widthMm > 10000} onClick={() => onStart(options)}>Dibujar camino</button>
  </details>;
}
