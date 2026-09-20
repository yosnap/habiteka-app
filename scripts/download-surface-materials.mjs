import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

// Curated, bounded import. No runtime dependency on the provider or arbitrary URLs.
const groups = {
  Madera: 'wood_floor wooden_floor_01 wooden_floor_02 herringbone_parquet diagonal_parquet rectangular_parquet oak_wood_planks dark_wood kitchen_wood fine_grained_wood dark_paneled_wood wood_plank_wall',
  Cerámica: 'interior_tiles grey_tiles long_white_tiles square_tiles square_tiles_02 square_tiles_03 floor_tiles_02 floor_tiles_04 floor_tiles_06 floor_tiles_08 terracotta_floor_tiles terrazzo_tiles',
  Mármol: 'marble_01 marble_tiles marble_mosaic_tiles',
  Piedra: 'stone_wall stone_wall_02 stacked_stone_wall stone_tiles stone_tiles_02 patterned_slate_tiles',
  Hormigón: 'concrete concrete_floor concrete_floor_01 brushed_concrete brushed_concrete_03 concrete_tiles concrete_tiles_02',
  Ladrillo: 'brick_wall_001 brick_wall_003 brick_4 brick_floor brick_floor_02 brick_floor_04 brick_pavement brick_pavement_02',
  Revestimiento: 'grey_plaster grey_plaster_02 grey_plaster_03 painted_plaster_wall white_plaster_02 white_plaster_rough_01 clay_plaster patterned_clay_plaster',
  Tela: 'fabric_pattern_05 fabric_pattern_07 fabric_leather_01 quatrefoil_jacquard_fabric',
};
const root = new URL('../public/materials/polyhaven/', import.meta.url);
await mkdir(root, { recursive: true });
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response;
}
const assets = await (await get('https://api.polyhaven.com/assets?t=textures')).json();
const catalog = [];
for (const [category, names] of Object.entries(groups)) {
  for (const name of names.split(' ')) {
    const asset = assets[name];
    if (!asset) throw new Error(`Missing asset ${name}`);
    const files = await (await get(`https://api.polyhaven.com/files/${name}`)).json();
    const dir = new URL(`${name}/`, root); await mkdir(dir, { recursive: true });
    const maps = {}, provenance = {};
    for (const [key, channel] of [['color', 'Diffuse'], ['normal', 'nor_gl'], ['roughness', 'Rough']]) {
      const source = (files[channel] ?? (key === 'color' ? files.col_01 ?? files.col_1 : undefined))?.['1k']?.jpg;
      if (!source || !source.url.startsWith('https://dl.polyhaven.org/')) throw new Error(`Missing ${channel}: ${name}`);
      const file = new URL(`${key}.jpg`, dir);
      let bytes;
      try { bytes = await readFile(file); } catch { bytes = Buffer.from(await (await get(source.url)).arrayBuffer()); }
      if (createHash('md5').update(bytes).digest('hex') !== source.md5) throw new Error(`Checksum mismatch ${name}/${key}`);
      await writeFile(file, bytes);
      maps[key] = `/materials/polyhaven/${name}/${key}.jpg`;
      provenance[key] = { url: source.url, md5: source.md5, bytes: bytes.length };
      if (key === 'color') await sharp(bytes).resize(160, 160).webp({ quality: 75 }).toFile(fileURLToPath(new URL('preview.webp', dir)));
    }
    catalog.push({ id: `polyhaven:${name}`, label: asset.name, category, source: `https://polyhaven.com/a/${name}`,
      license: 'CC0-1.0', authors: Object.keys(asset.authors ?? {}),
      sizeMm: asset.dimensions?.slice(0, 2).map(Math.round) ?? [1000, 1000],
      preview: `/materials/polyhaven/${name}/preview.webp`, maps, provenance });
    console.log(`${catalog.length}/60 ${name}`);
  }
}
if (catalog.length !== 60) throw new Error(`Expected 60, got ${catalog.length}`);
// One entry per line keeps the generated manifest reviewable and below file limits.
await writeFile(new URL('manifest.json', root), '[\n' + catalog.map((entry) => JSON.stringify(entry)).join(',\n') + '\n]\n');
