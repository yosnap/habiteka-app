'use client';

import { Download, DoorOpen, Frame, Minus, Plus, Rotate3d, Scissors, Layers3, PanelTop, LayoutGrid, PersonStanding } from 'lucide-react';
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

/** Visualización del techo, tal y como la guarda el editor. */
export type CeilingViewOption = 'hidden' | 'transparent' | 'solid';

const CEILING_LABELS: Record<CeilingViewOption, string> = {
  hidden: 'Oculto',
  transparent: 'Transparente',
  solid: 'Sólido',
};

/** Una estancia a la que se puede entrar con la cámara. */
export interface InteriorRoomOption {
  roomId: string;
  name: string;
  areaM2: number;
}

/** Etiqueta del desplegable: el nombre del plano o «Estancia N · m²». */
export function interiorRoomLabel(room: InteriorRoomOption, index: number): string {
  const area = `${room.areaM2.toFixed(1).replace('.', ',')} m²`;
  return room.name ? `${room.name} · ${area}` : `Estancia ${index + 1} · ${area}`;
}

interface SceneViewControlsProps {
  activeView: SceneViewPreset | null;
  maquetteActive: boolean;
  hasLevels: boolean;
  cutaway: boolean;
  allLevels: boolean;
  exporting: boolean;
  ceilingView: CeilingViewOption;
  /** Estancias disponibles para entrar; vacío si el plano no tiene ninguna cerrada. */
  interiorRooms: readonly InteriorRoomOption[];
  /** Estancia en la que está la cámara, o `null` si se ve desde fuera. */
  interiorRoomId: string | null;
  /** Entrar exige ver una sola planta: con todas activas el selector se bloquea. */
  interiorDisabledReason: string | null;
  onCamera: (action: SceneViewAction) => void;
  onViewChange: (preset: SceneViewPreset) => void;
  onMaquette: () => void;
  onCutawayChange: () => void;
  onAllLevelsChange: () => void;
  onCeilingViewChange: (view: CeilingViewOption) => void;
  onEnterRoom: (roomId: string | null) => void;
  canFreeWalk: boolean;
  onFreeWalk: () => void;
  onExport: () => void;
}

export function SceneViewControls({
  activeView,
  maquetteActive,
  hasLevels,
  cutaway,
  allLevels,
  exporting,
  ceilingView,
  interiorRooms,
  interiorRoomId,
  interiorDisabledReason,
  onCamera,
  onViewChange,
  onMaquette,
  onCutawayChange,
  onAllLevelsChange,
  onCeilingViewChange,
  onEnterRoom,
  canFreeWalk,
  onFreeWalk,
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
      <button type="button" className={styles.actionButton} aria-label="Ver maqueta cenital amueblada"
        title="Misma escena 3D del editor, vista desde arriba y sin techo" aria-pressed={maquetteActive} onClick={onMaquette}>
        <LayoutGrid size={15} aria-hidden="true" />
        <span>Maqueta</span>
      </button>
      {canFreeWalk && <button type="button" className={styles.actionButton} aria-label="Entrar al diseño en primera persona"
        title={canFreeWalk ? 'Camina por la misma escena del editor' : 'Necesitas una estancia transitable'}
        disabled={!canFreeWalk} onClick={onFreeWalk}>
        <PersonStanding size={15} aria-hidden="true" />
        <span>Visita</span>
      </button>}
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

    {interiorRooms.length > 0 && <div className={styles.group}>
      <label className={styles.selectLabel} title={interiorDisabledReason ?? 'Coloca la cámara dentro de la estancia, a altura de ojos'}>
        <DoorOpen size={15} aria-hidden="true" />
        <span className={styles.visuallyHidden}>Entrar en una estancia</span>
        <ModernSelect
          aria-label="Entrar en una estancia"
          className={`${styles.viewSelect} ${styles.wideSelect}`}
          disabled={Boolean(interiorDisabledReason)}
          value={interiorRoomId ?? 'menu'}
          onChange={(event) => {
            const value = event.target.value;
            if (value === 'menu') return;
            onEnterRoom(value === 'exit' ? null : value);
          }}
        >
          <option value="menu" disabled>Entrar en…</option>
          {interiorRooms.map((room, index) => (
            <option key={room.roomId} value={room.roomId}>{interiorRoomLabel(room, index)}</option>
          ))}
          {interiorRoomId && <option value="exit">Salir de la estancia</option>}
        </ModernSelect>
      </label>
    </div>}

    <div className={styles.group} aria-label="Visibilidad">
      <label className={styles.selectLabel} title="Cómo se ve el techo desde fuera">
        <PanelTop size={15} aria-hidden="true" />
        <span className={styles.visuallyHidden}>Techo</span>
        <ModernSelect
          aria-label="Techo"
          className={`${styles.viewSelect} ${styles.wideSelect}`}
          value={ceilingView}
          onChange={(event) => onCeilingViewChange(event.target.value as CeilingViewOption)}
        >
          {(Object.keys(CEILING_LABELS) as CeilingViewOption[]).map((option) => (
            <option key={option} value={option}>{`Techo: ${CEILING_LABELS[option]}`}</option>
          ))}
        </ModernSelect>
      </label>
      <button type="button" className={styles.actionButton} aria-label={cutaway ? 'Mostrar todos los muros' : 'Abrir vista interior'}
        title="Oculta los muros que miran a la cámara" aria-pressed={cutaway} onClick={onCutawayChange}>
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
