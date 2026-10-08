'use client';
import { useState } from 'react';
import { ArrowLeft, Import, X } from 'lucide-react';
import { CatalogPhoto } from './catalog-photo';
import { ConstructionCatalog, type ConstructionCategory, type ConstructionCatalogProps } from './construction-catalog';
import { ConstructionNavigationImage } from './construction-navigation-image';
import { constructionPhotoSource } from './construction-photos';
import { OutdoorSurfaceCatalog } from './outdoor-surface-catalog';
import { GardenPathControls } from './garden-path-controls';
import type { GardenPathOptions } from '@/lib/editor-document/garden-paths';
import type { OutdoorSurfacePresetId } from '@/lib/editor-document/outdoor-surface-presets';
import styles from './editor.module.css';
import photo from './catalog-photo.module.css';
import ui from './construction-menu.module.css';

interface ConstructionMenuProps extends Omit<ConstructionCatalogProps, 'category'> {
  onClose: () => void;
  onImport?: () => void;
  initialCategory?: ConstructionCategory | null;
  onTerrain?: () => void;
  onPaving?: (preset?: OutdoorSurfacePresetId) => void;
  onPath?: (options: GardenPathOptions) => void;
  onMixedGarden?: () => void;
}
const baseCategories = [
  { id: 'walls', label: 'Dibujar paredes' },
  { id: 'columns', label: 'Columnas' },
  { id: 'roof', label: 'Tejado' },
  { id: 'outdoor', label: 'Exterior y jardín' },
  { id: 'patio', label: 'Patio / terraza' },
  { id: 'rooms', label: 'Habitaciones' },
  { id: 'kitchen', label: 'Cocina' },
] as const;
const structureCategories = [
  { id: 'shapes', label: 'Formas' },
  { id: 'doors', label: 'Puertas' },
  { id: 'windows', label: 'Ventanas' },
  { id: 'passages', label: 'Huecos' },
  { id: 'ramps', label: 'Rampas' },
] as const;

export function ConstructionMenu({ onClose, onImport, initialCategory = null, onTerrain, onPaving, onPath, onMixedGarden, ...catalogProps }: ConstructionMenuProps) {
  const [category, setCategory] = useState<ConstructionCategory | null>(initialCategory);
  const categories = [...baseCategories, ...structureCategories,
    ...(catalogProps.onAddStair ? [{ id: 'stairs' as const, label: 'Escaleras' }] : [])];
  return <aside className={`${styles.constructionMenu} ${ui.panel}`} aria-label="Construir" onKeyDown={(event) => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
  }}>
    <div className={styles.constructionHeading}><h2>{category === 'outdoor' ? 'Exterior y jardín' : 'Construir'}</h2>
      <button type="button" onClick={onClose} aria-label="Cerrar construcción"><X size={20} aria-hidden="true" /></button>
    </div>
    <div className={ui.content}>
      {category ? <>
        <button type="button" className={ui.back} onClick={() => setCategory(null)}><ArrowLeft size={16} />Todas las categorías</button>
        {category === 'outdoor' && <div className={ui.surfaceActions}>
          {onTerrain && <button type="button" disabled={catalogProps.readOnly} onClick={onTerrain}>
            <CatalogPhoto source={constructionPhotoSource('terreno')} className={photo.cardPhoto} /><span>Añadir terreno</span></button>}
          {onPaving && <button type="button" disabled={catalogProps.readOnly} onClick={() => onPaving()}>
            <CatalogPhoto source={constructionPhotoSource('pavimento')} className={photo.cardPhoto} /><span>Añadir pavimento</span></button>}
        </div>}
        {category === 'outdoor' && onPaving && <OutdoorSurfaceCatalog disabled={catalogProps.readOnly} onChoose={onPaving} />}
        {category === 'outdoor' && onPath && <GardenPathControls disabled={catalogProps.readOnly} onStart={onPath} />}
        {category === 'outdoor' && onMixedGarden && <button type="button" disabled={catalogProps.readOnly} onClick={onMixedGarden}>Añadir jardín variado · 4 × 3 m</button>}
        <ConstructionCatalog {...catalogProps} category={category} />
      </> : <><p className={ui.intro}>Da forma a tu espacio. Elige qué quieres añadir.</p><nav className={ui.categories} aria-label="Categorías de construcción">
        {onImport && <button type="button" disabled={catalogProps.readOnly} onClick={onImport}>
          <Import size={18} aria-hidden="true" /><span>Importar plano</span>
        </button>}
        {categories.map(({ id, label }) => <button key={id} type="button" onClick={() => setCategory(id)}>
            <ConstructionNavigationImage category={id} /><span>{label}</span>
        </button>)}
      </nav></>}
    </div>
  </aside>;
}
