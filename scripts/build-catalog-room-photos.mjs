#!/usr/bin/env node
/**
 * Fotos de portada de las estancias «extra» del catálogo (Infantil, Recibidor, Lavadero y Garaje) renderizadas con
 * Blender a partir de los modelos del propio repositorio y de texturas CC0. Compone el atlas que espera
 * src/components/editor-v2/catalog-navigation-image.tsx: public/images/catalog/rooms-extra-v1.webp, 1024 × 682 px,
 * 2 × 2 celdas de 512 × 341 en el orden infantil, recibidor, lavadero, garaje.
 *
 * Pasos: descomprime en un directorio de trabajo los GLB usados (meshopt + WebP → GLB sin comprimir con PNG, que el
 * importador glTF de Blender sí lee; los del repositorio no se tocan), descarga con caché las texturas CC0 de ambientCG
 * y Poly Haven y el HDRI de Poly Haven, lanza Blender sin interfaz con scripts/blender/catalog_room_photos.py y compone
 * el atlas con sharp.
 *
 * Uso:
 *   node scripts/build-catalog-room-photos.mjs                    renderiza las cuatro estancias y escribe el atlas
 *   node scripts/build-catalog-room-photos.mjs --only=garaje      solo esas estancias (el atlas reutiliza el resto)
 *   --samples=N   muestras de Cycles por píxel (512 por defecto)
 *   --scale=N     resolución de render respecto a la celda (2 por defecto: 1024 × 682, reducida después a 512 × 341)
 * Variables: BLENDER (ruta del ejecutable, por defecto /Applications/Blender.app/Contents/MacOS/Blender) y
 * HABITEKA_ROOM_PHOTOS_DIR (directorio de trabajo, por defecto <tmp>/habiteka-catalog-room-photos).
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { CACHE_DIR, cc0Material, fetchJson, md5, request } from './lib/cc0-sources.mjs';
import { createGltfIO } from './lib/glb-optimize.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const BLENDER = process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender';
const SCRIPT = path.join(ROOT, 'scripts/blender/catalog_room_photos.py');
const WORK_DIR = process.env.HABITEKA_ROOM_PHOTOS_DIR ?? path.join(os.tmpdir(), 'habiteka-catalog-room-photos');
const ATLAS = path.join(ROOT, 'public/images/catalog/rooms-extra-v1.webp');
const CELL = { width: 512, height: 341 }, COLUMNS = 2;
const MAX_ATLAS_BYTES = 200 * 1024;
/** Orden de las celdas del atlas (izquierda a derecha, arriba abajo); debe coincidir con catalog-navigation-image.tsx. */
const ORDER = ['infantil', 'recibidor', 'lavadero', 'garaje'];
/** HDRI CC0 de Poly Haven: cielo y vegetación vistos por las ventanas y luz natural cálida de tarde. */
const HDRI = { id: 'dry_orchard_meadow', resolution: '4k' };

/**
 * Recursos de cada escena. `models`: clave → GLB del repositorio (relativo a public/models). `textures`: clave →
 * [fuente, id CC0, ancho real del mosaico en mm]. Lo que no está aquí (libros, juguetes, tipi, puertas, ventanas,
 * cortinas, cestas, toallas, bicicleta…) lo modela scripts/blender/catalog_room_photos.py.
 */
const SCENES = {
  infantil: {
    models: {
      cama: 'habiteka/cama_madera_90.glb', mesilla: 'habiteka/mesilla_roble_45.glb',
      estanteria: 'habiteka/estanteria_cubos_2x4.glb',
      alfombra: 'cc0/alfombra_redonda_yute_160.glb', planta: 'cc0/potted_plant_02.glb', maceta: 'cc0/potted_plant_04.glb',
    },
    textures: { suelo: ['ambientcg', 'WoodFloor047', 2000], pared: ['ambientcg', 'Plaster002', 2000], cesta: ['ambientcg', 'Wicker011A', 400] },
  },
  recibidor: {
    models: {
      consola: 'habiteka/consola_roble_100.glb', espejo: 'habiteka/espejo_redondo_80_laton.glb',
      banco: 'habiteka/banco_zapatero_100.glb', perchero: 'habiteka/perchero_pared_80.glb',
      planta: 'cc0/potted_plant_02.glb', jarron: 'cc0/ceramic_vase_02.glb',
    },
    textures: {
      suelo: ['ambientcg', 'Tiles143', 2400], pared: ['ambientcg', 'Plaster002', 2000], felpudo: ['ambientcg', 'Carpet014', 500],
      cesta: ['ambientcg', 'Wicker011A', 400],
    },
  },
  lavadero: {
    models: {
      lavadora: 'habiteka/lavadora_blanca.glb', secadora: 'habiteka/secadora_blanca.glb',
      escalera: 'habiteka/estanteria_escalera_60.glb', planta: 'cc0/potted_plant_04.glb',
    },
    textures: {
      suelo: ['ambientcg', 'Tiles139', 1200], pared: ['ambientcg', 'Plaster002', 2000], azulejo: ['ambientcg', 'Tiles136A', 800],
      roble: ['polyhaven', 'oak_veneer_01', 1830], cesta: ['ambientcg', 'Wicker011A', 400],
    },
  },
  garaje: {
    models: { estanteria: 'cc0/steel_frame_shelves_03.glb' },
    textures: { suelo: ['ambientcg', 'Concrete036', 2500], pared: ['ambientcg', 'Plaster002', 2000], carton: ['ambientcg', 'Cardboard004', 800] },
  },
};

function parseArgs(argv) {
  const value = (name) => argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
  const unknown = argv.filter((arg) => !/^--(only|samples|scale)=/.test(arg));
  if (unknown.length) throw new Error(`Argumentos desconocidos: ${unknown.join(' ')}`);
  const samples = Number(value('samples') ?? 512), scale = Number(value('scale') ?? 2);
  if (!Number.isInteger(samples) || samples < 8 || samples > 4096) throw new Error('--samples debe ser un entero entre 8 y 4096');
  if (![1, 2, 3].includes(scale)) throw new Error('--scale debe ser 1, 2 o 3');
  const only = value('only')?.split(',').filter(Boolean) ?? ORDER;
  const wrong = only.filter((id) => !ORDER.includes(id));
  if (wrong.length) throw new Error(`Estancias desconocidas: ${wrong.join(', ')} (válidas: ${ORDER.join(', ')})`);
  return { only, samples, scale };
}

/**
 * GLB sin meshopt y con texturas PNG en el directorio de trabajo (el original del repositorio no se modifica). La copia
 * lleva el hash del original en el nombre: si la fábrica regenera el modelo, se vuelve a descomprimir.
 */
async function decompressModel(io, relative) {
  const source = path.join(ROOT, 'public/models', relative);
  if (!existsSync(source)) throw new Error(`No existe public/models/${relative}`);
  const original = await readFile(source);
  const hash = createHash('sha256').update(original).digest('hex').slice(0, 12);
  const target = path.join(WORK_DIR, 'models', `${relative.replace(/[\\/]/g, '__').replace(/\.glb$/, '')}-${hash}.glb`);
  if (existsSync(target)) return target;
  const document = await io.readBinary(original);
  for (const texture of document.getRoot().listTextures()) {
    if (texture.getMimeType() !== 'image/webp') continue;
    texture.setImage(await sharp(Buffer.from(texture.getImage())).png().toBuffer()).setMimeType('image/png');
    texture.setURI(texture.getURI().replace(/\.webp$/i, '.png'));
  }
  for (const extension of document.getRoot().listExtensionsUsed()) {
    if (['EXT_meshopt_compression', 'EXT_texture_webp'].includes(extension.extensionName)) extension.dispose();
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, await io.writeBinary(document));
  return target;
}

/** Mapas de una textura CC0 como archivos (color, normal y rugosidad) y su tamaño real de mosaico en metros. */
async function prepareTexture([source, id, tileMm]) {
  const dir = path.join(WORK_DIR, 'textures', `${source}-${id}`);
  const files = { color: path.join(dir, 'color.jpg'), normal: path.join(dir, 'normal.jpg'), roughness: path.join(dir, 'roughness.png') };
  const meta = path.join(dir, 'meta.json');
  if (!Object.values(files).every(existsSync) || !existsSync(meta)) {
    const material = await cc0Material(source, id);
    await mkdir(dir, { recursive: true });
    await writeFile(files.color, material.maps.color);
    await writeFile(files.normal, material.maps.normal);
    const rough = sharp(material.maps.roughness);
    await (material.maps.roughnessChannel === 'green' ? rough.extractChannel('green') : rough.greyscale()).png().toFile(files.roughness);
    await writeFile(meta, JSON.stringify({ title: material.title, pageUrl: material.pageUrl, dimensionsMm: material.dimensionsMm ?? null }));
  }
  const { dimensionsMm } = JSON.parse(await readFile(meta, 'utf8'));
  const tile = (tileMm ?? dimensionsMm?.[0] ?? 1000) / 1000;
  return { ...files, tile, id: `${source}:${id}` };
}

/** HDRI de Poly Haven con caché local verificada con el MD5 publicado. */
async function prepareHdri({ id, resolution }) {
  const files = await fetchJson(`https://api.polyhaven.com/files/${id}`);
  const file = files?.hdri?.[resolution]?.hdr;
  if (!file?.url || !file.md5) throw new Error(`El HDRI ${id} no tiene versión ${resolution} en .hdr`);
  const target = path.join(CACHE_DIR, 'polyhaven-hdri', path.basename(new URL(file.url).pathname));
  if (existsSync(target) && md5(await readFile(target)) === file.md5) return target;
  console.log(`   descargando HDRI ${id} (${(file.size / 1048576).toFixed(1)} MB)`);
  const buffer = Buffer.from(await (await request(file.url)).arrayBuffer());
  if (md5(buffer) !== file.md5) throw new Error(`MD5 distinto en ${file.url}`);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer);
  return target;
}

async function prepareScene(io, id) {
  const spec = SCENES[id];
  const models = {};
  for (const [key, relative] of Object.entries(spec.models)) models[key] = await decompressModel(io, relative);
  const textures = {};
  for (const [key, source] of Object.entries(spec.textures)) textures[key] = await prepareTexture(source);
  console.log(`   ${id}: ${Object.values(spec.models).join(', ')} · ${Object.values(textures).map((t) => t.id).join(', ')}`);
  return { models, textures, output: path.join(WORK_DIR, 'renders', `${id}.png`) };
}

function runBlender(jobPath) {
  return new Promise((resolve, reject) => {
    // dont_write_bytecode: importar módulos de scripts/blender no deja cachés .pyc en el repositorio.
    const child = spawn(BLENDER, ['-b', '--factory-startup', '--python-expr', 'import sys; sys.dont_write_bytecode = True',
      '--python', SCRIPT, '--', '--job', jobPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    const onData = (chunk) => {
      const text = chunk.toString();
      tail = (tail + text).slice(-6000);
      for (const line of text.split('\n')) if (/^HK-|Error|Traceback/.test(line)) console.log(`   ${line}`);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (error) => reject(new Error(`No se pudo ejecutar Blender (${BLENDER}): ${error.message}`)));
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Blender terminó con código ${code}:\n${tail}`))));
  });
}

/** Reduce cada render al tamaño de celda, compone la cuadrícula y la guarda en WebP bajando calidad si pesa demasiado. */
async function composeAtlas() {
  const missing = ORDER.filter((id) => !existsSync(path.join(WORK_DIR, 'renders', `${id}.png`)));
  if (missing.length) throw new Error(`Faltan renders para el atlas: ${missing.join(', ')} (ejecuta sin --only)`);
  const cells = await Promise.all(ORDER.map(async (id, index) => ({
    input: await sharp(path.join(WORK_DIR, 'renders', `${id}.png`))
      .resize(CELL.width, CELL.height, { fit: 'cover', kernel: 'lanczos3' }).removeAlpha().png().toBuffer(),
    left: (index % COLUMNS) * CELL.width, top: Math.floor(index / COLUMNS) * CELL.height,
  })));
  const rows = Math.ceil(ORDER.length / COLUMNS);
  const canvas = await sharp({ create: { width: CELL.width * COLUMNS, height: CELL.height * rows, channels: 3, background: '#f2eee8' } })
    .composite(cells).png().toBuffer();
  for (const quality of [82, 78, 74, 70]) {
    const webp = await sharp(canvas).webp({ quality, effort: 6, smartSubsample: true }).toBuffer();
    if (webp.length <= MAX_ATLAS_BYTES || quality === 70) {
      if (webp.length > MAX_ATLAS_BYTES) console.warn(`   ⚠  el atlas pesa ${(webp.length / 1024).toFixed(0)} KB (objetivo ≤ 200 KB)`);
      await writeFile(ATLAS, webp);
      return { bytes: webp.length, quality };
    }
  }
  throw new Error('composición del atlas sin resultado');
}

async function main() {
  const { only, samples, scale } = parseArgs(process.argv.slice(2));
  await mkdir(path.join(WORK_DIR, 'renders'), { recursive: true });
  const io = await createGltfIO();
  console.log(`Preparando recursos en ${WORK_DIR}`);
  const scenes = {};
  for (const id of only) scenes[id] = await prepareScene(io, id);
  const job = {
    scenes, samples, hdri: await prepareHdri(HDRI),
    resolution: [CELL.width * scale, Math.round(CELL.width * scale * (CELL.height / CELL.width))],
  };
  // Se borran antes los renders de las escenas pedidas: si Blender falla sin código de error no se reutiliza uno viejo.
  await Promise.all(only.map((id) => rm(scenes[id].output, { force: true })));
  const jobPath = path.join(WORK_DIR, 'job.json');
  await writeFile(jobPath, JSON.stringify(job, null, 2));
  console.log(`Renderizando ${only.join(', ')} con Blender (${samples} muestras, ${job.resolution.join(' × ')} px)`);
  const started = Date.now();
  await runBlender(jobPath);
  console.log(`   render terminado en ${Math.round((Date.now() - started) / 1000)} s`);
  const failed = only.filter((id) => !existsSync(scenes[id].output));
  if (failed.length) throw new Error(`Blender no produjo el render de: ${failed.join(', ')}`);
  const { bytes, quality } = await composeAtlas();
  console.log(`Atlas: ${path.relative(ROOT, ATLAS)} · ${(bytes / 1024).toFixed(1)} KB · calidad WebP ${quality}`);
}

main().catch((error) => {
  console.error(`\n✖ ${error.message}`);
  process.exit(1);
});
