'use client';
import { useEffect, useRef, useState } from 'react';
import { catalogEntryFurniture, furniturePhotoSource, type CatalogPhotoSource, type RenderedPhotoSource } from '@/canvas/editor-v2/scene/catalog-photo-subjects';
import type { FurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { useCatalogPhoto } from './catalog-photo-cache';
import styles from './catalog-photo.module.css';

interface PhotoProps<Source> { source: Source | null; className?: string }

/**
 * Foto real de una pieza del catálogo o de una ficha. Si trae imagen pregenerada se muestra tal cual (con carga diferida
 * del navegador); si no, o si esa imagen no carga, se renderiza su modelo 3D en el navegador. Nunca hay dibujo de
 * respaldo: mientras carga se ve un barrido neutro y, si no hay foto posible, el marcador neutro quieto.
 */
export function CatalogPhoto({ source, className }: PhotoProps<CatalogPhotoSource>) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (source?.kind === 'image' && failedUrl !== source.url) {
    return <StaticPhoto key={source.url} url={source.url} className={className} onError={() => setFailedUrl(source.url)} />;
  }
  return <RenderedPhoto source={source?.kind === 'image' ? source.render : source} className={className} />;
}

/** Imagen pregenerada; el barrido neutro la cubre hasta que el navegador la ha cargado. */
function StaticPhoto({ url, className, onError }: { url: string; className?: string; onError: () => void }) {
  const image = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    // La imagen pudo cargarse (caché) antes de que React enganchara onLoad al hidratar.
    const element = image.current;
    if (element?.complete && element.naturalWidth > 0) setLoaded(true);
  }, []);
  return <span className={`${styles.photo} ${className ?? ''}`} data-photo-state={loaded ? 'ready' : 'loading'}>
    {/* Imagen estática ya optimizada (WebP de producto); next/image no aporta nada y la carga diferida es la del navegador. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img ref={image} src={url} alt="" loading="lazy" decoding="async" draggable={false} onLoad={() => setLoaded(true)} onError={onError} />
    {!loaded && <span className={styles.placeholder} aria-hidden="true" />}
  </span>;
}

/**
 * Render del modelo 3D, generado solo cuando la tarjeta entra en pantalla. Mientras se genera muestra el barrido
 * neutro; si no hay foto posible, el marcador neutro quieto.
 */
function RenderedPhoto({ source, className }: PhotoProps<RenderedPhotoSource>) {
  const frame = useRef<HTMLSpanElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = frame.current;
    if (seen || !element || typeof IntersectionObserver === 'undefined') return;
    // Margen generoso: la foto empieza a prepararse un poco antes de que la tarjeta llegue al borde del panel.
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setSeen(true); observer.disconnect(); }
    }, { rootMargin: '200px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [seen, source]);
  const photo = useCatalogPhoto(source, seen || typeof IntersectionObserver === 'undefined');
  if (!source || photo === null) return <span className={`${styles.photo} ${className ?? ''}`} data-photo-state="unavailable" aria-hidden="true" />;
  return <span ref={frame} className={`${styles.photo} ${className ?? ''}`} data-photo-state={photo ? 'ready' : 'loading'}>
    {/* La foto es una URL blob: local generada en el navegador; next/image no puede optimizarla. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {photo ? <img src={photo} alt="" decoding="async" draggable={false} /> : <span className={styles.placeholder} aria-hidden="true" />}
  </span>;
}

/** Fuente de la foto de una pieza del catálogo; si su geometría no se puede construir, la tarjeta muestra el marcador neutro. */
export function catalogEntryPhotoSource(entry: FurnitureCatalogEntry): CatalogPhotoSource | null {
  try {
    return furniturePhotoSource(catalogEntryFurniture(entry));
  } catch (error) {
    console.warn('Sin foto de catálogo para', entry.id, error);
    return null;
  }
}
