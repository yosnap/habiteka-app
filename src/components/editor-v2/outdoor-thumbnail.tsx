import type { FurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { outdoorVolumes } from '@/lib/editor-document/outdoor-volumes';

/** Miniatura isométrica del mismo modelo que aparece en el plano y en 3D. */
export function OutdoorThumbnail({ item }: { item: FurnitureCatalogEntry }) {
  const parts = outdoorVolumes({ ...item, id: item.id, catalogId: item.id, x: 0, y: 0, rotation: 0, dimensionalOrigin: 'physical' });
  const project = (x: number, y: number, z: number) => ({ x: (x - y) * .866, y: (x + y) * .5 - z });
  const corners = [0, item.widthMm].flatMap((x) => [0, item.depthMm].flatMap((y) =>
    [0, item.heightMm].map((z) => project(x, y, z))));
  const minX = Math.min(...corners.map((p) => p.x)), minY = Math.min(...corners.map((p) => p.y));
  const width = Math.max(...corners.map((p) => p.x)) - minX, height = Math.max(...corners.map((p) => p.y)) - minY;
  const scale = Math.min(88 / width, 62 / height);
  const point = (x: number, y: number, z: number) => {
    const p = project(x, y, z); return `${50 + (p.x - minX - width / 2) * scale},${36 + (p.y - minY - height / 2) * scale}`;
  };
  return <svg viewBox="0 0 100 72" width="100" height="72" role="img" aria-label={item.label}>
    {parts.toSorted((a, b) => (a.x + a.y + a.bottom) - (b.x + b.y + b.bottom)).map((p, index) => {
      const x = p.x, y = p.y, r = x + p.widthMm, b = y + p.depthMm, z = p.top, low = p.bottom;
      return <g key={index} fill={p.color ?? item.color} stroke="#46544b" strokeWidth=".4" strokeLinejoin="round">
        <polygon points={[point(x, b, low), point(r, b, low), point(r, b, z), point(x, b, z)].join(' ')} />
        <polygon points={[point(r, y, low), point(r, b, low), point(r, b, z), point(r, y, z)].join(' ')} />
        <polygon points={[point(x, y, z), point(r, y, z), point(r, b, z), point(x, b, z)].join(' ')} />
      </g>;
    })}
  </svg>;
}
