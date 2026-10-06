import sharp from 'sharp';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import type { RenderView } from '@/lib/editor-document/render-view';
import type { RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { wallPath } from '@/lib/editor-document/wall-path';
import { leafEnds, worldOpeningLeaves } from '@/lib/editor-document/opening-leaves';
import { renderSpatialContext, spatialLevels, type RenderSpatialContext } from './render-spatial-context';

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
const number = (value: number) => Number(value.toFixed(2));

/** Plano auxiliar determinista: usos, huecos y hojas rígidas del mismo modelo 3D. */
export async function renderSpatialReference(document: EditorDocument, view: RenderView, options: RenderDesignOptions) {
  const context = renderSpatialContext(document, view, options);
  const svg = spatialReferenceSvg(document, view, context);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return { context, image: { base64: png.toString('base64'), mimeType: 'image/png' as const } };
}

export function spatialReferenceSvg(document: EditorDocument, view: RenderView, context: RenderSpatialContext): string {
  const levels = spatialLevels(document, view), columns = Math.min(2, Math.max(1, levels.length));
  const size = 1000, rows = Math.ceil(levels.length / columns);
  const tiles = levels.map((level, index) => {
    const doc = level.document, data = context.levels[index]!;
    const points = [...doc.vertices, ...data.rooms.map(room => room.anchor)];
    const xs = points.map(point => point.x), ys = points.map(point => point.y);
    const minX = points.length ? Math.min(...xs) : 0, minY = points.length ? Math.min(...ys) : 0;
    const maxX = points.length ? Math.max(...xs) : 1, maxY = points.length ? Math.max(...ys) : 1;
    const scale = (size - 120) / Math.max(1, maxX - minX, maxY - minY);
    const project = (p: Point) => ({ x: 60 + (p.x - minX) * scale, y: 75 + (p.y - minY) * scale });
    const path = (p: Point[]) => p.map((point, i) => { const at = project(point); return `${i ? 'L' : 'M'} ${number(at.x)} ${number(at.y)}`; }).join(' ');
    const tag = (p: Point, text: string, color: string, font = 15) => {
      const at = project(p);
      return `<text x="${number(at.x)}" y="${number(at.y)}" text-anchor="middle" font-size="${font}" font-family="sans-serif" fill="${color}" stroke="#fff" stroke-width="4" paint-order="stroke">${escape(text)}</text>`;
    };
    const roomShapes = data.rooms.map(room => `${room.boundary ? `<path d="${path(room.boundary)} Z" fill="#e2f1ea" stroke="#97b9aa" stroke-width="1"/>` : ''}`).join('');
    const walls = doc.walls.filter(wall => !wall.hidden).map(wall => {
      const geometry = wallPath(doc, wall), width = Math.max(2, wall.thicknessMm * scale);
      const gaps = doc.openings.filter(opening => opening.wallId === wall.id).map(opening => {
        const half = opening.widthMm / geometry.length / 2;
        return `<path d="${path(geometry.samples(opening.position - half, opening.position + half))}" stroke="${opening.kind === 'ventana' ? '#418ac4' : '#fff'}" fill="none" stroke-width="${number(width + 2)}"/>`;
      }).join('');
      return `<path d="${path(geometry.samples())}" fill="none" stroke="#343c38" stroke-width="${number(width)}"/>${gaps}`;
    }).join('');
    const knownWalls = new Set(doc.walls.filter(wall => !wall.hidden).map(wall => wall.id));
    // Abanico de cada hoja abatible y franja de las correderas vistas y plegables: todo debe quedar libre de muebles.
    const swings = data.openings.flatMap(opening => [opening.swingClearance, opening.secondSwingClearance, opening.slideClearance]
      .flatMap(zone => zone ? [`<path d="${path(zone.polygon)} Z" fill="#fff1ce" fill-opacity="0.7" stroke="#a86618" stroke-width="1" stroke-dasharray="3 3"/>`] : [])).join('');
    const leaves = doc.openings.filter(opening => opening.kind === 'puerta' && knownWalls.has(opening.wallId))
      .flatMap(opening => worldOpeningLeaves(doc, opening)?.leaves ?? [])
      .map(leaf => `<path d="${path(leafEnds(leaf))}" stroke="#a86618" stroke-width="3"/>`).join('');
    const shortId = (id: string) => id.replace(/^L\d+-/, '');
    const labels = data.rooms.map(room => tag(room.anchor, `${shortId(room.id)}: ${room.name}`, '#075c46', 16)).join('');
    const dimensions = data.openings.map(opening => [shortId(opening.id),
      opening.kind === 'hueco' ? 'SIN PUERTA' : opening.type ?? opening.kind, `${opening.widthMm} mm`]
      .map((line, index) => tag({ x: opening.center.x, y: opening.center.y + (index - 1) * 12 / scale }, line, '#254eb4', 11)).join('')).join('');
    return `<g transform="translate(${index % columns * size},${Math.floor(index / columns) * size})"><rect width="${size}" height="${size}" fill="#fff"/><text x="35" y="30" font-family="sans-serif" font-size="20" fill="#222">L${index + 1} · ${escape(data.name)} · mapa de usos y huecos</text>${roomShapes}${swings}${walls}${leaves}${labels}${dimensions}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${columns * size}" height="${Math.max(1, rows) * size}">${tiles}</svg>`;
}
