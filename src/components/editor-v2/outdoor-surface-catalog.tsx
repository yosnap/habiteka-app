'use client';
import { OUTDOOR_SURFACE_PRESETS, type OutdoorSurfacePresetId } from '@/lib/editor-document/outdoor-surface-presets';
import { SURFACE_MATERIALS } from '@/lib/editor-document/surface-materials';
import { CatalogPhoto } from './catalog-photo';
import styles from './editor.module.css';
import photo from './catalog-photo.module.css';
import ui from './construction-menu.module.css';

export function OutdoorSurfaceCatalog({ disabled, onChoose }: { disabled: boolean; onChoose: (id: OutdoorSurfacePresetId) => void }) {
  return <details className={ui.gardenSection}><summary>Superficies · asfalto, grava, tierra y césped</summary>
    <p>Cubre una zona completa. Ajusta sus medidas y posición después de colocarla.</p>
    <div className={`${styles.constructionCards} ${photo.photoGrid}`}>
      {OUTDOOR_SURFACE_PRESETS.map((preset) => {
        const material = SURFACE_MATERIALS.find((entry) => entry.id === preset.texture);
        return <button type="button" key={preset.id} disabled={disabled} onClick={() => onChoose(preset.id)}>
          <CatalogPhoto className={photo.cardPhoto} source={material ? { kind: 'image', key: material.preview, url: material.preview, render: null } : null} />
          <strong>{preset.name}</strong><small>Superficie sin marcas</small>
        </button>;
      })}
    </div>
  </details>;
}
