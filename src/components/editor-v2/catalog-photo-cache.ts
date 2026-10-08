'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { CATALOG_PHOTO_VERSION, type RenderedPhotoSource } from '@/canvas/editor-v2/scene/catalog-photo-subjects';
import { captureCatalogPhoto } from './catalog-photo-render';

const CACHE_PREFIX = 'habiteka-catalog-photos-';
const CACHE_NAME = `${CACHE_PREFIX}v${CATALOG_PHOTO_VERSION}`;

/** Foto lista (URL local), `null` si falló (la tarjeta muestra su dibujo) y sin entrada mientras no se ha pedido. */
const photos = new Map<string, string | null>();
const pending = new Set<string>();
const listeners = new Set<() => void>();
let pruned = false;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Las fotos se guardan en Cache Storage con una URL propia del sitio, que nunca se pide a la red. */
const cacheRequest = (key: string) => new Request(new URL(`/__catalog-photos/${encodeURIComponent(key)}`, window.location.origin));

/** Abre la caché de esta versión y borra una sola vez las de versiones anteriores. Sin almacenamiento, `null`. */
async function openPhotoCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return null;
  try {
    if (!pruned) {
      pruned = true;
      const stale = (await caches.keys()).filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME);
      await Promise.all(stale.map((name) => caches.delete(name)));
    }
    return await caches.open(CACHE_NAME);
  } catch {
    // Navegación privada, contexto no seguro o cuota agotada: se trabaja solo en memoria.
    return null;
  }
}

async function readStoredPhoto(key: string): Promise<Blob | null> {
  try {
    const response = await (await openPhotoCache())?.match(cacheRequest(key));
    return response ? await response.blob() : null;
  } catch {
    return null;
  }
}

async function storePhoto(key: string, blob: Blob): Promise<void> {
  try {
    await (await openPhotoCache())?.put(cacheRequest(key), new Response(blob, { headers: { 'content-type': blob.type || 'image/webp' } }));
  } catch (error) {
    console.warn('No se pudo guardar la foto del catálogo en el navegador', error);
  }
}

function requestPhoto(source: RenderedPhotoSource) {
  const { key } = source;
  if (typeof window === 'undefined' || photos.has(key) || pending.has(key)) return;
  pending.add(key);
  void (async () => {
    let url: string | null = null;
    try {
      const stored = await readStoredPhoto(key);
      const blob = stored ?? await captureCatalogPhoto(source);
      if (!stored) void storePhoto(key, blob);
      url = URL.createObjectURL(blob);
    } catch (error) {
      console.warn('Foto del catálogo no disponible; se muestra su dibujo', key, error);
    }
    photos.set(key, url);
    pending.delete(key);
    listeners.forEach((listener) => listener());
  })();
}

/**
 * Foto de catálogo de una pieza: la primera vez se renderiza en el navegador y se guarda en Cache Storage; las
 * siguientes sale de ahí al instante. Solo se pide cuando `active` (la tarjeta está a la vista). Devuelve la URL de la
 * foto, `null` si no se pudo hacer, o `undefined` mientras se prepara.
 */
export function useCatalogPhoto(source: RenderedPhotoSource | null, active: boolean): string | null | undefined {
  const key = source?.key ?? null;
  useEffect(() => { if (active && source) requestPhoto(source); }, [active, source]);
  return useSyncExternalStore(subscribe, () => key ? photos.get(key) : undefined, () => undefined);
}
