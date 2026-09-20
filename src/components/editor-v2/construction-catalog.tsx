'use client';
import { OutdoorConstructionCatalog } from './outdoor-construction-catalog';
import type { FurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { Columns2, CookingPot, DoorOpen, MoveUpRight, RectangleHorizontal, ScanLine, Slash } from 'lucide-react';
import type { EditorTool } from '@/canvas/editor-v2/store';
import type { Stair } from '@/lib/editor-document/schema';
import styles from './editor.module.css';

export type ConstructionCategory = 'outdoor' | 'patio' | 'walls' | 'rooms' | 'kitchen' | 'shapes' | 'doors' | 'windows' | 'passages' | 'stairs' | 'ramps' | 'columns';
export interface ConstructionCatalogProps {
  category: ConstructionCategory;
  onAddOutdoor?: (item: FurnitureCatalogEntry) => void;
  readOnly: boolean;
  onTool: (tool: EditorTool) => void;
  onShape: (shape: 'L' | 'U' | 'T') => void;
  onAddStair?: (kind: Stair['kind']) => void;
  onAddRamp?: () => void;
  onAddLanding?: () => void;
  onAddColumn?: () => void;
}
const entries = {
  patio: { title: 'Patio / terraza', icon: RectangleHorizontal, label: 'Superficie exterior', detail: 'Dibuja un área abierta. Pulsa su suelo para elegir césped, tierra, gravilla o pavimento. Los elementos se añaden desde Construir → Exterior y jardín.', tool: 'patio' },
  walls: { title: 'Dibujar paredes', icon: Slash, label: 'Pared recta', detail: 'Dibuja el contorno de tu espacio o un tramo abierto', tool: 'wall' },
  rooms: { title: 'Habitaciones', icon: RectangleHorizontal, label: 'Habitación rectangular', detail: 'Dibuja una habitación cerrada', tool: 'rectangle' },
  kitchen: { title: 'Cocina', icon: CookingPot, label: 'Mueble lineal de cocina', detail: 'Trázalo como una pared, pegado al muro: módulos bajos con encimera. Después añade aparatos y módulos altos desde Propiedades.', tool: 'kitchen' },
  doors: { title: 'Puertas', icon: DoorOpen, label: 'Puerta abatible', detail: 'Colócala sobre una pared', tool: 'door' },
  windows: { title: 'Ventanas', icon: Columns2, label: 'Ventana', detail: 'Colócala sobre una pared', tool: 'window' },
  passages: { title: 'Huecos', icon: ScanLine, label: 'Paso abierto', detail: 'Una abertura sin carpintería', tool: 'passage' },
} as const;

/** Only offers construction actions backed by a real command or tool. */
export function ConstructionCatalog({ category, readOnly, onTool, onShape, onAddStair, onAddRamp, onAddLanding, onAddColumn, onAddOutdoor }: ConstructionCatalogProps) {
  if (category === 'outdoor') return <OutdoorConstructionCatalog readOnly={readOnly} onAdd={onAddOutdoor} />;
  if (category === 'columns') return <div className={styles.constructionCatalog}><h3>Columnas</h3><p>Soporte estructural independiente de los muros.</p>
    {onAddColumn && <div className={styles.constructionCards}><button type="button" disabled={readOnly} onClick={onAddColumn}>
      <Columns2 size={48} aria-hidden="true" /><strong>Columna rectangular</strong><small>40 × 40 cm, ajustable</small>
    </button></div>}</div>;
  if (category === 'shapes') return <div className={styles.constructionCatalog}>
    <h3>Formas</h3><p>Figuras independientes para modelar el espacio; no crean habitaciones.</p>
    <div className={styles.constructionCards}>{(['L', 'U', 'T'] as const).map((shape) =>
      <button type="button" key={shape} disabled title="Próximamente: formas 3D independientes">
        <span className={styles.shapePreview} data-shape={shape} aria-hidden="true">{shape}</span>
        <strong>Forma {shape}</strong><small>Próximamente</small>
      </button>)}</div>
  </div>;
  if (category === 'stairs') return <div className={styles.constructionCatalog}>
    <h3>Escaleras</h3>
    {(onAddStair || onAddLanding) && <div className={styles.constructionCards}>{onAddStair && (['straight', 'L', 'U'] as const).map((kind) =>
      <button type="button" key={kind} disabled={readOnly} onClick={() => onAddStair(kind)}>
        <MoveUpRight size={48} aria-hidden="true" /><strong>Escalera {kind === 'straight' ? 'recta' : `en ${kind}`}</strong>
        <small>Añadir al plano</small>
      </button>)}{onAddLanding && <button type="button" disabled={readOnly} onClick={onAddLanding}>
        <RectangleHorizontal size={48} aria-hidden="true" /><strong>Descansillo</strong><small>Plataforma común para rampas y escaleras</small>
      </button>}</div>}
  </div>;
  if (category === 'ramps') return <div className={styles.constructionCatalog}>
    <h3>Rampas</h3><p>Superficie inclinada continua para salvar desniveles.</p>
    {(onAddRamp || onAddLanding) && <div className={styles.constructionCards}>{onAddRamp && <button type="button" disabled={readOnly} onClick={onAddRamp}>
      <MoveUpRight size={48} aria-hidden="true" /><strong>Rampa recta</strong><small>Añadir al plano</small>
    </button>}{onAddLanding && <button type="button" disabled={readOnly} onClick={onAddLanding}>
      <RectangleHorizontal size={48} aria-hidden="true" /><strong>Descansillo</strong><small>Plataforma horizontal independiente</small>
    </button>}</div>}
  </div>;
  const item = entries[category], Icon = item.icon;
  return <div className={styles.constructionCatalog}>
    <h3>{item.title}</h3><p>{item.detail}</p>
    <div className={styles.constructionCards}><button type="button" disabled={readOnly} onClick={() => onTool(item.tool)}>
      <Icon size={48} strokeWidth={1.25} aria-hidden="true" /><strong>{item.label}</strong>
      <small>{category === 'walls' ? 'Dibujar en el lienzo' : category === 'kitchen' ? 'Clics por tramos pegados al muro' : category === 'patio' ? 'Clics para cerrar el contorno' : category === 'rooms' ? 'Arrastra entre dos esquinas' : 'Elegir y colocar'}</small>
    </button>{category === 'walls' && <button type="button" disabled={readOnly} onClick={() => onTool('guard-wall')}>
      <RectangleHorizontal size={48} aria-hidden="true" /><strong>Murete de protección</strong><small>Tramo independiente de 1,10 m; se apoya en el descansillo</small>
    </button>}</div>
    {category === 'rooms' && <div className={styles.constructionCards}>{(['L', 'U', 'T'] as const).map((shape) => <button type="button" key={shape}
      disabled={readOnly} onClick={() => onShape(shape)}><span className={styles.shapePreview} data-shape={shape} aria-hidden="true">{shape}</span>
      <strong>Habitación en {shape}</strong><small>Contorno cerrado editable</small></button>)}</div>}
  </div>;
}
