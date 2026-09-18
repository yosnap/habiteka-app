'use client';
import { useState } from 'react';
import { ChevronRight, Columns2, DoorOpen, Import, MoveUpRight, RectangleHorizontal, ScanLine, Shapes, Slash, X } from 'lucide-react';
import { ConstructionCatalog, type ConstructionCategory, type ConstructionCatalogProps } from './construction-catalog';
import styles from './editor.module.css';

interface ConstructionMenuProps extends Omit<ConstructionCatalogProps, 'category'> {
  onClose: () => void;
  onImport?: () => void;
}
const baseCategories = [
  { id: 'walls', label: 'Dibujar paredes', icon: Slash },
  { id: 'columns', label: 'Columnas', icon: Columns2 },
  { id: 'outdoor', label: 'Exterior y jardín', icon: Shapes },
  { id: 'patio', label: 'Patio / terraza', icon: RectangleHorizontal },
  { id: 'rooms', label: 'Habitaciones', icon: RectangleHorizontal },
] as const;
const structureCategories = [
  { id: 'shapes', label: 'Formas', icon: Shapes },
  { id: 'doors', label: 'Puertas', icon: DoorOpen },
  { id: 'windows', label: 'Ventanas', icon: Columns2 },
  { id: 'passages', label: 'Huecos', icon: ScanLine },
  { id: 'ramps', label: 'Rampas', icon: MoveUpRight },
] as const;

export function ConstructionMenu({ onClose, onImport, ...catalogProps }: ConstructionMenuProps) {
  const [category, setCategory] = useState<ConstructionCategory>('walls');
  const categories = [...baseCategories, ...structureCategories,
    ...(catalogProps.onAddStair ? [{ id: 'stairs' as const, label: 'Escaleras', icon: MoveUpRight }] : [])];
  return <aside className={styles.constructionMenu} aria-label="Construir" onKeyDown={(event) => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
  }}>
    <div className={styles.constructionHeading}><h2>Construir</h2>
      <button type="button" onClick={onClose} aria-label="Cerrar construcción"><X size={20} aria-hidden="true" /></button>
    </div>
    <div className={styles.constructionBody}>
      <nav className={styles.constructionCategories} aria-label="Categorías de construcción">
        {onImport && <button type="button" disabled={catalogProps.readOnly} onClick={onImport}>
          <Import size={18} aria-hidden="true" /><span>Importar plano</span>
        </button>}
        {categories.map(({ id, label, icon: Icon }) => <div key={id}>
          {id === 'doors' && <h3>Construcciones</h3>}
          <button type="button" aria-current={category === id ? 'true' : undefined} onClick={() => setCategory(id)}>
            <Icon size={20} aria-hidden="true" /><span>{label}</span><ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>)}
      </nav>
      <ConstructionCatalog {...catalogProps} category={category} />
    </div>
  </aside>;
}
