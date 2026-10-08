'use client';
import { CatalogPhoto } from './catalog-photo';
import { constructionPhotoSource } from './construction-photos';
import type { RoofAction } from './use-roof-workflow';
import styles from './editor.module.css';
import photo from './catalog-photo.module.css';

export function RoofConstructionCatalog({ readOnly, onAction }: { readOnly: boolean; onAction?: (action: RoofAction) => void }) {
  return <div className={styles.constructionCatalog}>
    <h3>Tejado</h3><p>Configura la cubierta y coloca sus piezas directamente en el plano 2D.</p>
    <div className={`${styles.constructionCards} ${photo.photoGrid}`}>
      {([
        ['tejado', 'Tejado exterior', 'Forma, pendiente, alero y habitaciones', 'configure'],
        ['cristal-tejado', 'Cristal de techo', 'Colocar en el plano; tamaño editable', 'glass'],
        ['ventana-tejado', 'Ventana de techo', 'Con marco; para una habitación o ático', 'roof-window'],
        ['chimenea-tejado', 'Salida de chimenea', 'Conducto, altura y sombrerete', 'chimney'],
      ] as const).map(([id, label, detail, action]) => <button type="button" key={id} disabled={readOnly || !onAction} onClick={() => onAction?.(action)}>
        <CatalogPhoto source={constructionPhotoSource(id)} className={photo.cardPhoto} /><strong>{label}</strong><small>{detail}</small>
      </button>)}
    </div>
    <div className="mt-3 flex flex-col gap-2">
      <button type="button" onClick={() => onAction?.('edit')}>Editar tejado en plano 2D · mostrar</button>
      <button type="button" onClick={() => onAction?.('preview')}>Ver tejado en 3D</button>
      <button type="button" onClick={() => onAction?.('hide')}>Ocultar tejado y techo en 3D</button>
    </div>
  </div>;
}
