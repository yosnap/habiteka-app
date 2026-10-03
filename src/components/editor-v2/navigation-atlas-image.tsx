'use client';
import Image from 'next/image';
import { useState, type ReactNode } from 'react';
import styles from './navigation-atlas-image.module.css';

/** Una celda decorativa de un atlas fotográfico estático compartido entre tarjetas. */
export function NavigationAtlasImage({ src, width, height, columns, rows, cell, region, fallback }: {
  src: string; width: number; height: number; columns: number; rows: number; cell: number; fallback: ReactNode;
  region?: { x: number; y: number; width: number; height: number };
}) {
  const [failed, setFailed] = useState(false);
  const crop = region ?? { x: cell % columns * width / columns, y: Math.floor(cell / columns) * height / rows, width: width / columns, height: height / rows };
  return <span className={styles.viewport} style={{ aspectRatio: crop.width / crop.height }} aria-hidden="true">
    {failed ? fallback : <Image src={src} alt="" unoptimized width={width} height={height}
      className={styles.atlas} onError={() => setFailed(true)}
      style={{ width: `${width / crop.width * 100}%`, height: `${height / crop.height * 100}%`, left: `${-crop.x / crop.width * 100}%`, top: `${-crop.y / crop.height * 100}%` }} />}
  </span>;
}
