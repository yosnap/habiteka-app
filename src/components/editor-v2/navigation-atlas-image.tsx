'use client';
import Image from 'next/image';
import { useState } from 'react';
import photo from './catalog-photo.module.css';
import styles from './navigation-atlas-image.module.css';

/**
 * Una celda decorativa de un atlas fotográfico estático compartido entre tarjetas. Mientras carga se ve el barrido
 * neutro de las fotos del catálogo; si el atlas no carga, el marcador neutro quieto (nunca un dibujo).
 */
export function NavigationAtlasImage({ src, width, height, columns, rows, cell, region }: {
  src: string; width: number; height: number; columns: number; rows: number; cell: number;
  region?: { x: number; y: number; width: number; height: number };
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const crop = region ?? { x: cell % columns * width / columns, y: Math.floor(cell / columns) * height / rows, width: width / columns, height: height / rows };
  return <span className={styles.viewport} style={{ aspectRatio: crop.width / crop.height }} aria-hidden="true" data-photo-state={state}>
    {state !== 'failed' && <Image src={src} alt="" unoptimized width={width} height={height}
      className={styles.atlas} onLoad={() => setState('ready')} onError={() => setState('failed')}
      style={{ width: `${width / crop.width * 100}%`, height: `${height / crop.height * 100}%`, left: `${-crop.x / crop.width * 100}%`, top: `${-crop.y / crop.height * 100}%` }} />}
    {state === 'loading' && <span className={photo.placeholder} />}
  </span>;
}
