'use client';

import type { CameraPose } from '@/lib/contracts/walkthrough-keyframe';
import { sameCameraPose, type StoryboardGalleryImage, type StoryboardImage } from '@/lib/contracts/storyboard-image';
import styles from './storyboard-panel.module.css';

export function StoryboardImageCard({ image, camera, gallery, disabled, onChoose }: {
  image?: StoryboardImage;
  camera?: CameraPose;
  gallery: StoryboardGalleryImage[];
  disabled: boolean;
  onChoose: (image: StoryboardGalleryImage) => void;
}) {
  const result = gallery.find((item) => item.id === image?.deliverableId);
  const compatible = camera ? gallery.filter((item) => sameCameraPose(item.camera, camera)) : [];
  return <>
    {result ? <a href={result.assetUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir imagen de esta vista">
      {/* Las URLs firmadas se renuevan en la galería; no pasan por el optimizador. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.thumbnail} src={result.assetUrl} alt="Imagen guardada de esta vista" loading="lazy" />
      Abrir imagen
    </a> : <span>{image ? 'Imagen no disponible. Actualiza la galería.' : 'Sin imagen asignada'}</span>}
    {image && (!camera || !sameCameraPose(image.camera, camera)) && <span role="status">El encuadre cambió. Regenera esta vista.</span>}
    <details>
      <summary>Elegir de la galería</summary>
      {!compatible.length && <p>No hay imágenes con esta cámara. Genera una desde este punto; las imágenes antiguas sin cámara no se pueden asociar todavía.</p>}
      <div className={styles.gallery}>
        {compatible.map((candidate) => <button type="button" key={candidate.id} disabled={disabled}
          aria-label={`Usar ${candidate.label} (${candidate.id.slice(-6)})`} onClick={(event) => {
            onChoose(candidate);
            event.currentTarget.closest('details')?.removeAttribute('open');
          }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.thumbnail} src={candidate.assetUrl} alt={candidate.label} loading="lazy" />
          {candidate.label}
        </button>)}
      </div>
    </details>
  </>;
}
