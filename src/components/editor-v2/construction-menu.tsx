'use client';
import { useState } from 'react';
import { ArrowLeft, Columns2, CookingPot, DoorOpen, Grid3X3, Import, MoveUpRight, RectangleHorizontal, ScanLine, Shapes, Slash, Sprout, X } from 'lucide-react';
import { ConstructionCatalog, type ConstructionCategory, type ConstructionCatalogProps } from './construction-catalog';
import { ConstructionNavigationImage } from './construction-navigation-image';
import styles from './editor.module.css';
import ui from './construction-menu.module.css';

interface ConstructionMenuProps extends Omit<ConstructionCatalogProps, 'category'> {
  onClose: () => void;
  onImport?: () => void;
  initialCategory?: ConstructionCategory | null;
  onTerrain?: () => void;
  onPaving?: () => void;
}
const baseCategories = [
  { id: 'walls', label: 'Dibujar paredes', icon: Slash },
  { id: 'columns', label: 'Columnas', icon: Columns2 },
  { id: 'outdoor', label: 'Exterior y jardín', icon: Shapes },
  { id: 'patio', label: 'Patio / terraza', icon: RectangleHorizontal },
  { id: 'rooms', label: 'Habitaciones', icon: RectangleHorizontal },
  { id: 'kitchen', label: 'Cocina', icon: CookingPot },
] as const;
const structureCategories = [
  { id: 'shapes', label: 'Formas', icon: Shapes },
  { id: 'doors', label: 'Puertas', icon: DoorOpen },
  { id: 'windows', label: 'Ventanas', icon: Columns2 },
  { id: 'passages', label: 'Huecos', icon: ScanLine },
  { id: 'ramps', label: 'Rampas', icon: MoveUpRight },
] as const;

export function ConstructionMenu({ onClose, onImport, initialCategory = null, onTerrain, onPaving, ...catalogProps }: ConstructionMenuProps) {
  const [category, setCategory] = useState<ConstructionCategory | null>(initialCategory);
  const categories = [...baseCategories, ...structureCategories,
    ...(catalogProps.onAddStair ? [{ id: 'stairs' as const, label: 'Escaleras', icon: MoveUpRight }] : [])];
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
            <ConstructionNavigationImage category="terrain" fallback={<Sprout size={32} />} /><span>Añadir terreno</span></button>}
          {onPaving && <button type="button" disabled={catalogProps.readOnly} onClick={onPaving}>
            <ConstructionNavigationImage category="paving" fallback={<Grid3X3 size={32} />} /><span>Añadir pavimento</span></button>}
        </div>}
        <ConstructionCatalog {...catalogProps} category={category} />
      </> : <><p className={ui.intro}>Da forma a tu espacio. Elige qué quieres añadir.</p><nav className={ui.categories} aria-label="Categorías de construcción">
        {onImport && <button type="button" disabled={catalogProps.readOnly} onClick={onImport}>
          <Import size={18} aria-hidden="true" /><span>Importar plano</span>
        </button>}
        {categories.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setCategory(id)}>
            <ConstructionNavigationImage category={id} fallback={<Icon size={44} strokeWidth={1.5} />} /><span>{label}</span>
        </button>)}
      </nav></>}
    </div>
  </aside>;
}
