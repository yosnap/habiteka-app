'use client';
import { Columns2, DoorOpen, MoveUpRight, RectangleHorizontal, ScanLine, Slash, Shapes } from 'lucide-react';
import type { EditorTool } from '@/canvas/editor-v2/store';
import type { Stair } from '@/lib/editor-document/schema';
import styles from './editor.module.css';

export type ConstructionCategory = 'walls' | 'rooms' | 'shapes' | 'doors' | 'windows' | 'passages' | 'stairs';
export interface ConstructionCatalogProps {
  category: ConstructionCategory;
  readOnly: boolean;
  onTool: (tool: EditorTool) => void;
  onShape: (shape: 'L' | 'U' | 'T') => void;
  onAddStair?: (kind: Stair['kind']) => void;
}
const entries = {
  walls: { title: 'Dibujar paredes', icon: Slash, label: 'Pared recta', detail: 'Dibuja el contorno de tu espacio', tool: 'wall' },
  rooms: { title: 'Habitaciones', icon: RectangleHorizontal, label: 'Habitación rectangular', detail: 'Dibuja una habitación cerrada', tool: 'rectangle' },
  doors: { title: 'Puertas', icon: DoorOpen, label: 'Puerta abatible', detail: 'Colócala sobre una pared', tool: 'door' },
  windows: { title: 'Ventanas', icon: Columns2, label: 'Ventana', detail: 'Colócala sobre una pared', tool: 'window' },
  passages: { title: 'Huecos', icon: ScanLine, label: 'Paso abierto', detail: 'Una abertura sin carpintería', tool: 'passage' },
} as const;

/** Only offers construction actions backed by a real command or tool. */
export function ConstructionCatalog({ category, readOnly, onTool, onShape, onAddStair }: ConstructionCatalogProps) {
  if (category === 'shapes') return <div className={styles.constructionCatalog}>
    <h3>Formas de habitación</h3><p>Empieza con una forma y ajusta sus paredes.</p>
    <div className={styles.constructionCards}>{(['L', 'U', 'T'] as const).map((shape) =>
      <button type="button" key={shape} disabled={readOnly} onClick={() => onShape(shape)}>
        <span className={styles.shapePreview} data-shape={shape} aria-hidden="true">{shape}</span>
        <strong>Habitación en {shape}</strong><small>Contorno editable</small>
      </button>)}</div>
  </div>;
  if (category === 'stairs') return <div className={styles.constructionCatalog}>
    <h3>Escaleras</h3>
    {onAddStair && <div className={styles.constructionCards}>{(['straight', 'L', 'U'] as const).map((kind) =>
      <button type="button" key={kind} disabled={readOnly} onClick={() => onAddStair(kind)}>
        <MoveUpRight size={48} aria-hidden="true" /><strong>Escalera {kind === 'straight' ? 'recta' : `en ${kind}`}</strong>
        <small>Añadir al plano</small>
      </button>)}</div>}
  </div>;
  const item = entries[category], Icon = item.icon;
  return <div className={styles.constructionCatalog}>
    <h3>{item.title}</h3><p>{item.detail}</p>
    <div className={styles.constructionCards}><button type="button" disabled={readOnly} onClick={() => onTool(item.tool)}>
      <Icon size={48} strokeWidth={1.25} aria-hidden="true" /><strong>{item.label}</strong>
      <small>{category === 'walls' ? 'Dibujar en el lienzo' : category === 'rooms' ? 'Arrastra entre dos esquinas' : 'Elegir y colocar'}</small>
    </button></div>
    {category === 'rooms' && <button type="button" className={styles.catalogSecondary} disabled={readOnly} onClick={() => onShape('L')}>
      <Shapes size={20} aria-hidden="true" />Añadir habitación en L
    </button>}
  </div>;
}
