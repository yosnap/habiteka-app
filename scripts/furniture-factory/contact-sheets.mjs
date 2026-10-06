/** Hojas de contacto por familia (miniaturas con su id) para revisar la fábrica de un vistazo. */
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { THUMBS_DIR } from './registry.mjs';

const TILE_W = 384, TILE_H = 288, COLS = 4, ROWS = 3;
const escape = (text) => text.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

/** Escribe <dir>/fabrica-muebles-<familia>-<n>.jpg (12 piezas por hoja) y devuelve las rutas. */
export async function writeContactSheets(pieces, dir, families) {
  await mkdir(dir, { recursive: true });
  const written = [];
  for (const family of families) {
    const items = pieces.filter((piece) => piece.family === family && existsSync(path.join(THUMBS_DIR, `${piece.id}.webp`)));
    for (let page = 0; page * COLS * ROWS < items.length; page++) {
      const slice = items.slice(page * COLS * ROWS, (page + 1) * COLS * ROWS);
      const tiles = await Promise.all(slice.map(async (piece, index) => {
        const label = Buffer.from(`<svg width="${TILE_W}" height="${TILE_H}"><rect y="${TILE_H - 24}" width="${TILE_W}" height="24" fill="#000" opacity=".55"/><text x="6" y="${TILE_H - 7}" font-size="14" font-family="Helvetica" fill="#fff">${escape(piece.id)}</text></svg>`);
        const input = await sharp(path.join(THUMBS_DIR, `${piece.id}.webp`)).resize(TILE_W, TILE_H).composite([{ input: label }]).png().toBuffer();
        return { input, left: (index % COLS) * TILE_W, top: Math.floor(index / COLS) * TILE_H };
      }));
      const rows = Math.ceil(slice.length / COLS);
      const file = path.join(dir, `fabrica-muebles-${family}-${page + 1}.jpg`);
      await sharp({ create: { width: COLS * TILE_W, height: rows * TILE_H, channels: 3, background: '#ffffff' } })
        .composite(tiles).jpeg({ quality: 82 }).toFile(file);
      written.push(file);
    }
  }
  return written;
}
