#!/usr/bin/env node
/**
 * Importa materiales PBR CC0 (ambientCG y Poly Haven) a la biblioteca local del editor: public/materials/cc0.
 *
 * Por cada material descarga los mapas 1K (color, normal OpenGL y rugosidad), los reduce y convierte a WebP
 * (color y normal ≤ 1024 px; rugosidad ≤ 512 px, basta para el teselado), genera una miniatura y registra la
 * procedencia: public/materials/cc0/manifest.json (id, nombre, categoría, ficha de origen, licencia CC0, autores, fecha),
 * que el editor carga solo (src/lib/editor-document/surface-materials.ts), y public/materials/cc0/sources.json (URL de
 * descarga y SHA-256 de cada archivo generado), que no entra en el paquete del navegador.
 * La selección curada, con nombres en español y categoría, está en scripts/cc0-material-selection.mjs.
 *
 * Uso:
 *   node scripts/import-cc0-materials.mjs                          importa la selección que aún no exista
 *   node scripts/import-cc0-materials.mjs ambientcg:Tiles010       importa solo esos materiales de la selección
 *   node scripts/import-cc0-materials.mjs --force [ids…]           reimporta aunque ya existan
 *   node scripts/import-cc0-materials.mjs "polyhaven:id:Nombre:Categoría[:anchoMm]"   importa uno fuera de la selección
 *   node scripts/import-cc0-materials.mjs --list=<texto>           busca candidatos en ambos catálogos
 *   --dry-run                                                      procesa sin escribir en public/ ni en el manifiesto
 * Las descargas se guardan en la caché temporal del sistema (habiteka-cc0-cache) y se reutilizan.
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { cc0Material, fetchJson, sha256 } from './lib/cc0-sources.mjs';
import { CATEGORY_DEFAULT_MM, MATERIAL_SELECTION } from './cc0-material-selection.mjs';

const LIBRARY_DIR = fileURLToPath(new URL('../public/materials/cc0/', import.meta.url));
const MANIFEST = path.join(LIBRARY_DIR, 'manifest.json'), SOURCES = path.join(LIBRARY_DIR, 'sources.json');
const PUBLIC_PREFIX = '/materials/cc0';
const MAX_PX = 1024, ROUGHNESS_PX = 512, PREVIEW_PX = 160;
const BUDGET_BYTES = 60 * 1024 * 1024;
const PROVIDERS = { ambientcg: 'ambientCG', polyhaven: 'Poly Haven' };

const materialId = (source, id) => `${source}:${id}`;
const folderName = (source, id) => `${source}-${id.toLowerCase()}`;

function parseEntry([source, id, label, category, widthMm]) {
  if (!PROVIDERS[source]) throw new Error(`Fuente no admitida: ${source}`);
  if (!label?.trim() || !(category in CATEGORY_DEFAULT_MM)) throw new Error(`Nombre o categoría no válidos para ${source}:${id}`);
  if (widthMm !== undefined && !(Number.isFinite(widthMm) && widthMm >= 50 && widthMm <= 10000)) throw new Error(`Ancho no válido para ${id}`);
  return { source, id, label: label.trim(), category, widthMm };
}

/** Convierte un mapa a WebP con un lado máximo; la rugosidad va en gris (de un canal si viene empaquetada). */
async function encode(buffer, { maxPx, quality, channel }) {
  let image = sharp(buffer).rotate();
  if (channel === 'green') image = image.extractChannel('green');
  if (channel) image = image.toColourspace('b-w');
  return image.resize(maxPx, maxPx, { fit: 'inside', withoutEnlargement: true }).webp({ quality, effort: 6 }).toBuffer();
}

async function importMaterial(manifest, sources, entry, { force, dryRun }) {
  const id = materialId(entry.source, entry.id), folder = folderName(entry.source, entry.id);
  const directory = path.join(LIBRARY_DIR, folder);
  if (!force && manifest.some((item) => item.id === id) && existsSync(path.join(directory, 'color.webp'))) {
    return console.log(`⏭  ${id} ya existe (usa --force para reimportarlo)`);
  }
  const source = await cc0Material(entry.source, entry.id);
  const roughnessChannel = source.maps.roughnessChannel;
  const outputs = {
    color: await encode(source.maps.color, { maxPx: MAX_PX, quality: 80 }),
    normal: await encode(source.maps.normal, { maxPx: MAX_PX, quality: 82 }),
    roughness: await encode(source.maps.roughness, { maxPx: ROUGHNESS_PX, quality: 75, channel: roughnessChannel ?? 'grey' }),
    preview: await sharp(source.maps.color).resize(PREVIEW_PX, PREVIEW_PX, { fit: 'cover' }).webp({ quality: 70 }).toBuffer(),
  };
  const { width = 1, height = 1 } = await sharp(outputs.color).metadata();
  const widthMm = Math.round(entry.widthMm ?? source.dimensionsMm?.[0] ?? CATEGORY_DEFAULT_MM[entry.category]);
  const files = Object.fromEntries(Object.entries(outputs).map(([key, buffer]) => [key, { sha256: sha256(buffer), bytes: buffer.length }]));
  const url = (key) => `${PUBLIC_PREFIX}/${folder}/${key}.webp`;
  const material = {
    id, label: entry.label, category: entry.category, source: source.pageUrl, license: 'CC0-1.0', authors: source.authors,
    sizeMm: [widthMm, Math.round(widthMm * height / width)], preview: url('preview'),
    maps: { color: url('color'), normal: url('normal'), roughness: url('roughness') },
    provenance: { provider: PROVIDERS[entry.source], assetId: entry.id, title: source.title, importedAt: new Date().toISOString().slice(0, 10) },
  };
  if (!dryRun) {
    await mkdir(directory, { recursive: true });
    await Promise.all(Object.entries(outputs).map(([key, buffer]) => writeFile(path.join(directory, `${key}.webp`), buffer)));
    const index = manifest.findIndex((item) => item.id === id);
    if (index >= 0) manifest[index] = material; else manifest.push(material);
    sources[id] = { downloads: source.downloads, files };
  }
  const total = Object.values(outputs).reduce((sum, buffer) => sum + buffer.length, 0);
  console.log(`✓ ${id.padEnd(40)} ${entry.label.padEnd(36)} ${material.sizeMm.join('×')} mm  ${(total / 1024).toFixed(0)} KB`);
}

/** Una línea por material: los archivos quedan revisables en un diff. Se ordenan como la selección curada. */
function serialize(manifest, sources) {
  const order = new Map(MATERIAL_SELECTION.map(([source, id], index) => [materialId(source, id), index]));
  const sorted = [...manifest].sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
  return {
    manifest: `[\n${sorted.map((item) => JSON.stringify(item)).join(',\n')}\n]\n`,
    sources: `{\n${sorted.map(({ id }) => `${JSON.stringify(id)}: ${JSON.stringify(sources[id])}`).join(',\n')}\n}\n`,
  };
}

async function folderBytes(directory) {
  let total = 0;
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, item.name);
    total += item.isDirectory() ? await folderBytes(full) : (await stat(full)).size;
  }
  return total;
}

async function list(query) {
  const text = query.toLowerCase();
  const acg = await fetchJson('https://ambientcg.com/api/v2/full_json?type=Material&limit=2500&include=tagData,displayData,dimensionsData');
  for (const asset of acg.foundAssets ?? []) {
    if (![asset.assetId, asset.displayCategory, ...(asset.tags ?? [])].join(' ').toLowerCase().includes(text)) continue;
    console.log(`ambientcg:${asset.assetId} | ${asset.displayCategory} | ${asset.dimensionX ? `${asset.dimensionX * 10} mm` : 's/m'} | ${(asset.tags ?? []).join(', ')}`);
  }
  const ph = await fetchJson('https://api.polyhaven.com/assets?type=textures');
  for (const [id, asset] of Object.entries(ph)) {
    if (![id, asset.name, ...(asset.categories ?? []), ...(asset.tags ?? [])].join(' ').toLowerCase().includes(text)) continue;
    console.log(`polyhaven:${id} | ${asset.categories?.join(', ')} | ${asset.dimensions?.[0] ? `${Math.round(asset.dimensions[0])} mm` : 's/m'}`);
  }
}

function selection(args) {
  const ids = args.filter((arg) => !arg.startsWith('--'));
  const curated = MATERIAL_SELECTION.map(parseEntry);
  if (!ids.length) return curated;
  return ids.map((arg) => {
    const [source, id, label, category, width] = arg.split(':');
    const known = curated.find((entry) => entry.source === source && entry.id === id);
    if (known && !label) return known;
    if (!label) throw new Error(`${source}:${id} no está en la selección: usa fuente:id:Nombre:Categoría[:anchoMm]`);
    return parseEntry([source, id, label, category, width === undefined ? undefined : Number(width)]);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const listArg = args.find((arg) => arg.startsWith('--list='));
  if (listArg) return list(listArg.slice('--list='.length));
  const options = { force: args.includes('--force'), dryRun: args.includes('--dry-run') };
  const entries = selection(args);
  const ids = entries.map((entry) => materialId(entry.source, entry.id));
  if (new Set(ids).size !== ids.length) throw new Error('La selección repite materiales');
  const manifest = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : [];
  const sources = existsSync(SOURCES) ? JSON.parse(await readFile(SOURCES, 'utf8')) : {};
  const failures = [];
  for (const entry of entries) {
    try {
      await importMaterial(manifest, sources, entry, options);
    } catch (error) {
      failures.push(`${entry.source}:${entry.id}`);
      console.error(`✗ ${entry.source}:${entry.id}: ${error instanceof Error ? error.message : error}`);
    }
  }
  if (!options.dryRun) {
    // Quita del disco las carpetas que ya no figuran en el manifiesto (materiales retirados de la selección).
    await mkdir(LIBRARY_DIR, { recursive: true });
    const kept = new Set(manifest.map((item) => item.maps.color.split('/')[3]));
    for (const item of await readdir(LIBRARY_DIR, { withFileTypes: true })) {
      if (item.isDirectory() && !kept.has(item.name)) await rm(path.join(LIBRARY_DIR, item.name), { recursive: true });
    }
    const output = serialize(manifest, sources);
    await writeFile(MANIFEST, output.manifest);
    await writeFile(SOURCES, output.sources);
    const bytes = await folderBytes(LIBRARY_DIR);
    console.log(`\n${manifest.length} materiales · ${(bytes / 1048576).toFixed(1)} MB en ${PUBLIC_PREFIX}`);
    if (bytes > BUDGET_BYTES) { console.error(`La biblioteca supera el presupuesto de ${BUDGET_BYTES / 1048576} MB`); process.exitCode = 1; }
  }
  if (failures.length) { console.error(`\nFallaron ${failures.length}: ${failures.join(', ')}`); process.exitCode = 1; }
}

main().catch((error) => { console.error(error); process.exit(1); });
