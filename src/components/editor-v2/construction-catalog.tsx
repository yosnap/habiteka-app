'use client';
import { OutdoorConstructionCatalog } from './outdoor-construction-catalog';
import type { FurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { OpeningTypeCatalog } from './opening-type-catalog';
import { CatalogPhoto } from './catalog-photo';
import { constructionSection, type ConstructionCardAction } from './construction-cards';
import { constructionPhotoSource } from './construction-photos';
import type { EditorTool } from '@/canvas/editor-v2/store';
import type { Stair } from '@/lib/editor-document/schema';
import styles from './editor.module.css';
import photo from './catalog-photo.module.css';

export type ConstructionCategory = 'outdoor' | 'patio' | 'walls' | 'rooms' | 'kitchen' | 'shapes' | 'doors' | 'windows' | 'passages' | 'stairs' | 'ramps' | 'columns';
export interface ConstructionCatalogProps {
  category: ConstructionCategory;
  onAddOutdoor?: (item: FurnitureCatalogEntry) => void;
  readOnly: boolean;
  /** Con `openingTypeId`, la herramienta de puerta o ventana empieza con ese tipo elegido. */
  onTool: (tool: EditorTool, openingTypeId?: string) => void;
  onShape: (shape: 'L' | 'U' | 'T') => void;
  onAddStair?: (kind: Stair['kind']) => void;
  onAddRamp?: () => void;
  onAddLanding?: () => void;
  onAddColumn?: () => void;
}
/** Ejecuta la acción de la ficha; `undefined` si el editor no ofrece ese comando (la ficha no se muestra). */
function cardHandler(action: ConstructionCardAction, props: ConstructionCatalogProps): (() => void) | undefined {
  switch (action.type) {
    case 'tool': return () => props.onTool(action.tool);
    case 'room-shape': return () => props.onShape(action.shape);
    case 'stair': { const addStair = props.onAddStair; return addStair && (() => addStair(action.kind)); }
    case 'ramp': return props.onAddRamp;
    case 'landing': return props.onAddLanding;
    case 'column': return props.onAddColumn;
    case 'coming-soon': return undefined;
  }
}

/** Only offers construction actions backed by a real command or tool. */
export function ConstructionCatalog(props: ConstructionCatalogProps) {
  const { category, readOnly, onTool, onAddOutdoor } = props;
  if (category === 'outdoor') return <OutdoorConstructionCatalog readOnly={readOnly} onAdd={onAddOutdoor} />;
  if (category === 'doors' || category === 'windows') return <OpeningTypeCatalog kind={category === 'doors' ? 'puerta' : 'ventana'}
    readOnly={readOnly} onChoose={(card) => onTool(card.tool, card.typeId)} />;
  const section = constructionSection(category);
  const cards = section.cards.map((card) => ({ card, run: cardHandler(card.action, props) }))
    .filter(({ card, run }) => run || card.action.type === 'coming-soon');
  return <div className={styles.constructionCatalog}>
    <h3>{section.title}</h3>{section.intro && <p>{section.intro}</p>}
    {cards.length > 0 && <div className={`${styles.constructionCards} ${photo.photoGrid}`}>{cards.map(({ card, run }) =>
      <button type="button" key={card.id} disabled={readOnly || !run} onClick={run} title={run ? undefined : 'Próximamente: formas 3D independientes'}>
        <CatalogPhoto source={constructionPhotoSource(card.photo)} className={photo.cardPhoto} /><strong>{card.label}</strong><small>{card.detail}</small>
      </button>)}</div>}
  </div>;
}
