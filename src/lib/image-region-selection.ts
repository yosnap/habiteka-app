import type { NormalizedBBox, NormalizedPoint } from './contracts';

/** Rectángulo ocupado por una imagen con object-fit: contain, sin sus márgenes. */
export function containedImageRect(container: { width: number; height: number }, image: { width: number; height: number }) {
  if (container.width <= 0 || container.height <= 0 || image.width <= 0 || image.height <= 0) return null;
  const scale = Math.min(container.width / image.width, container.height / image.height);
  const width = image.width * scale, height = image.height * scale;
  return { x: (container.width - width) / 2, y: (container.height - height) / 2, width, height };
}

export function boxBetween(a: NormalizedPoint, b: NormalizedPoint): NormalizedBBox {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, width: Math.min(1 - x, Math.abs(b.x - a.x)), height: Math.min(1 - y, Math.abs(b.y - a.y)) };
}

/** Flechas desplazan; Mayús + flechas ajusta el tamaño sin salir de la imagen. */
export function nudgeImageRegion(box: NormalizedBBox, key: string, resize: boolean): NormalizedBBox {
  const dx = key === 'ArrowRight' ? .01 : key === 'ArrowLeft' ? -.01 : 0;
  const dy = key === 'ArrowDown' ? .01 : key === 'ArrowUp' ? -.01 : 0;
  if (resize) return { ...box, width: Math.min(1 - box.x, Math.max(.01, box.width + dx)), height: Math.min(1 - box.y, Math.max(.01, box.height + dy)) };
  return { ...box, x: Math.max(0, Math.min(1 - box.width, box.x + dx)), y: Math.max(0, Math.min(1 - box.height, box.y + dy)) };
}
