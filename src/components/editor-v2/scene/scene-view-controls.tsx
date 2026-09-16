'use client';

import { Download, Frame, Minus, Plus, Rotate3d, Scissors, Layers3 } from 'lucide-react';
import { ModernSelect } from '@/components/ui/modern-select';
import type { CameraRequest, SceneCameraPreset } from './scene-camera';
import styles from './scene-view-controls.module.css';

export type SceneViewPreset = SceneCameraPreset;
export type SceneViewAction = CameraRequest['action'];

const VIEW_LABELS: Record<SceneViewPreset, string> = {
  top: 'Cenital',
  isometric: 'Isométrica',
  front: 'Frontal',
  back: 'Trasera',
  left: 'Izquierda',
  right: 'Derecha',
  drone: 'Dron',
};

interface SceneViewControlsProps {
  activeView: SceneViewPreset | null;
  hasLevels: boolean;
  cutaway: boolean;
  allLevels: boolean;
  exporting: boolean;
  onCamera: (action: SceneViewAction) => void;
  onViewChange: (preset: SceneViewPreset) => void;
  onCutawayChange: () => void;
  onAllLevelsChange: () => void;
  onExport: () => void;
}

export function SceneViewControls({
  activeView,
  hasLevels,
  cutaway,
  allLevels,
  exporting,
  onCamera,
  onViewChange,
  onCutawayChange,
  onAllLevelsChange,
  onExport,
}: SceneViewControlsProps) {
  return <div className={styles.controls} role="toolbar" aria-label="Controles de la vista 3D">
    <div className={styles.group} aria-label="Navegación de cámara">
      <button type="button" className={styles.iconButton} onClick={() => onCamera('out')} aria-label="Alejar en 3D" title="Alejar">
        <Minus size={16} aria-hidden="true" />
      </button>
      <button type="button" className={styles.iconButton} onClick={() => onCamera('in')} aria-label="Acercar en 3D" title="Acercar">
        <Plus size={16} aria-hidden="true" />
      </button>
      <button type="button" className={styles.actionButton} aria-label="Encuadrar 3D" title="Encuadrar 3D" onClick={() => onCamera('fit')}>
        <Frame size={15} aria-hidden="true" />
        <span>Encuadrar</span>
      </button>
    </div>

    <div className={styles.group}>
      <label className={styles.selectLabel}>
        <Rotate3d size={15} aria-hidden="true" />
        <span className={styles.visuallyHidden}>Vistas</span>
        <ModernSelect
          aria-label="Vistas"
          className={styles.viewSelect}
          value={activeView ?? 'menu'}
          onChange={(event) => {
            const value = event.target.value;
            if (value !== 'menu') onViewChange(value as SceneViewPreset);
          }}
        >
          <option value="menu" disabled>Vistas</option>
          {(Object.keys(VIEW_LABELS) as SceneViewPreset[]).map((preset) => (
            <option key={preset} value={preset}>{VIEW_LABELS[preset]}</option>
          ))}
        </ModernSelect>
      </label>
    </div>

    <div className={styles.group} aria-label="Visibilidad">
      <button type="button" className={styles.actionButton} aria-label={cutaway ? 'Mostrar todos los muros' : 'Abrir vista interior'}
        title={cutaway ? 'Mostrar todos los muros' : 'Abrir vista interior'} aria-pressed={cutaway} onClick={onCutawayChange}>
        <Scissors size={15} aria-hidden="true" />
        <span>{cutaway ? 'Interior' : 'Muros'}</span>
      </button>
      {hasLevels && <button type="button" className={styles.actionButton} aria-label={allLevels ? 'Solo planta activa' : 'Ver todas las plantas'} aria-pressed={allLevels} onClick={onAllLevelsChange}>
        <Layers3 size={15} aria-hidden="true" />
        <span>{allLevels ? 'Una planta' : 'Plantas'}</span>
      </button>}
    </div>

    <div className={styles.group} aria-label="Exportar">
      <button type="button" className={`${styles.actionButton} ${styles.exportButton}`} aria-label="Exportar y guardar PNG" title="Exportar y guardar PNG" onClick={onExport} disabled={exporting}>
        <Download size={15} aria-hidden="true" />
        <span>{exporting ? 'Exportando…' : 'Exportar PNG'}</span>
      </button>
    </div>
  </div>;
}

export default SceneViewControls;
