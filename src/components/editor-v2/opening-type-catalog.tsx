'use client';
import { useMemo } from 'react';
import { openingPhotoSource } from '@/canvas/editor-v2/scene/catalog-photo-subjects';
import type { OpeningTypeKind } from '@/lib/editor-document/opening-types';
import { CatalogPhoto } from './catalog-photo';
import { openingTypeSections, type OpeningTypeCard } from './opening-type-cards';
import styles from './editor.module.css';
import photo from './catalog-photo.module.css';

const intro: Record<OpeningTypeKind, { title: string; detail: string }> = {
  puerta: { title: 'Puertas', detail: 'Elige el tipo y pulsa sobre una pared para colocarla con sus medidas y su acabado. En Exterior y garaje encontrarás puertas de garaje y portones exteriores correderos, también montados en pared. Después puedes cambiar medidas, diseño, acabado y tirador en Propiedades. Con la tecla D, sin elegir tipo, una puerta en una fachada a la calle entra como puerta de entrada.' },
  ventana: { title: 'Ventanas', detail: 'Elige el tipo y pulsa sobre una pared para colocarla con sus medidas y su altura; después puedes cambiar medidas y marco en Propiedades.' },
};

function OpeningTypePhoto({ card }: { card: OpeningTypeCard }) {
  const source = useMemo(() => {
    try { return openingPhotoSource(card.typeId); } catch { return null; }
  }, [card.typeId]);
  return <CatalogPhoto source={source} className={photo.cardPhoto} />;
}

/**
 * Construir → Puertas o Ventanas: una tarjeta con foto por tipo, las puertas agrupadas por apartados; al pulsarla, la
 * herramienta queda lista con ese tipo.
 */
export function OpeningTypeCatalog({ kind, readOnly, onChoose }: { kind: OpeningTypeKind; readOnly: boolean; onChoose: (card: OpeningTypeCard) => void }) {
  const sections = useMemo(() => openingTypeSections(kind), [kind]);
  return <div className={styles.constructionCatalog}>
    <h3>{intro[kind].title}</h3><p>{intro[kind].detail}</p>
    {sections.map((section) => <section key={section.id} aria-label={section.title ?? intro[kind].title}>
      {section.title && <h4>{section.title}</h4>}
      <div className={`${styles.constructionCards} ${photo.photoGrid}`}>{section.cards.map((card) =>
        <button type="button" key={card.typeId} disabled={readOnly} onClick={() => onChoose(card)} aria-label={`Colocar ${card.label}`}>
          <OpeningTypePhoto card={card} /><strong>{card.label}</strong><small>{card.detail}</small>
        </button>)}</div>
    </section>)}
  </div>;
}
