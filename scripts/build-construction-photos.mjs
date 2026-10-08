#!/usr/bin/env node
/**
 * Fotos de producto de las fichas de Construir (src/components/editor-v2/construction-photos.ts) renderizadas con
 * Blender (Cycles) a partir de geometría modelada en scripts/blender/construction_photos.py y de las texturas CC0 que ya
 * están en public/materials (cc0 y polyhaven). Escribe public/images/construction/<escena>.webp a 336 × 224 px (el
 * doble de la ficha), con el mismo fondo claro neutro que las fotos de los muebles.
 *
 * Uso:
 *   node scripts/build-construction-photos.mjs                      todas las escenas
 *   node scripts/build-construction-photos.mjs --only=pared,rampa   solo esas escenas
 *   --samples=N   muestras de Cycles por píxel (256 por defecto)
 *   --scale=N     resolución del render respecto a la foto final (3 por defecto: 1008 × 672, reducida después)
 * Variables: BLENDER (ruta del ejecutable, por defecto /Applications/Blender.app/Contents/MacOS/Blender) y
 * HABITEKA_CONSTRUCTION_PHOTOS_DIR (directorio de trabajo, por defecto <tmp>/habiteka-construction-photos).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const BLENDER = process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender';
const SCRIPT = path.join(ROOT, 'scripts/blender/construction_photos.py');
const WORK_DIR = process.env.HABITEKA_CONSTRUCTION_PHOTOS_DIR ?? path.join(os.tmpdir(), 'habiteka-construction-photos');
const OUT_DIR = path.join(ROOT, 'public/images/construction');
const PHOTO = { width: 336, height: 224 };
const MAX_PHOTO_BYTES = 40 * 1024;
const MANIFESTS = ['public/materials/cc0/manifest.json', 'public/materials/polyhaven/manifest.json'];
/** Clave de textura del script de Blender → material CC0 del catálogo de acabados. */
const TEXTURES = {
  plaster: 'ambientcg:Plaster002', oak: 'ambientcg:WoodFloor051',
  stone: 'ambientcg:Travertine009', kitchen: 'polyhaven:kitchen_wood', marble: 'ambientcg:Marble021',
  microcement: 'ambientcg:Concrete034', patio: 'ambientcg:Tiles143', pavers: 'polyhaven:brick_pavement_02',
  grass: 'polyhaven:grass_ground', brick: 'ambientcg:Bricks092',
};

function parseArgs(argv) {
  const value = (name) => argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
  const unknown = argv.filter((arg) => !/^--(only|samples|scale)=/.test(arg));
  if (unknown.length) throw new Error(`Argumentos desconocidos: ${unknown.join(' ')}`);
  const samples = Number(value('samples') ?? 256), scale = Number(value('scale') ?? 3);
  if (!Number.isInteger(samples) || samples < 8 || samples > 4096) throw new Error('--samples debe ser un entero entre 8 y 4096');
  if (![1, 2, 3, 4].includes(scale)) throw new Error('--scale debe ser 1, 2, 3 o 4');
  const only = value('only')?.split(',').filter(Boolean) ?? null;
  if (only?.some((id) => !/^[a-z0-9-]+$/.test(id))) throw new Error('--only admite identificadores de escena separados por comas');
  return { only, samples, scale };
}

/** Mapas locales (color, normal y rugosidad) y mosaico real en metros de cada textura, solo si su licencia es CC0. */
async function resolveTextures() {
  const entries = new Map();
  for (const file of MANIFESTS) {
    for (const entry of JSON.parse(await readFile(path.join(ROOT, file), 'utf8'))) entries.set(entry.id, entry);
  }
  const textures = {};
  for (const [key, id] of Object.entries(TEXTURES)) {
    const entry = entries.get(id);
    if (!entry) throw new Error(`La textura ${id} no está en ${MANIFESTS.join(' ni en ')}`);
    if (entry.license !== 'CC0-1.0') throw new Error(`La textura ${id} no es CC0 (${entry.license})`);
    const maps = {};
    for (const map of ['color', 'normal', 'roughness']) {
      const file = path.join(ROOT, 'public', entry.maps[map]);
      if (!existsSync(file)) throw new Error(`Falta el mapa ${map} de ${id}: ${file}`);
      maps[map] = file;
    }
    textures[key] = { ...maps, tile: entry.sizeMm[0] / 1000 };
  }
  return textures;
}

function runBlender(jobPath) {
  return new Promise((resolve, reject) => {
    const done = [];
    // dont_write_bytecode: importar módulos de scripts/blender no deja cachés .pyc en el repositorio.
    // --python-exit-code: una excepción en el script termina Blender con error en lugar de seguir como si nada.
    const child = spawn(BLENDER, ['-b', '--factory-startup', '--python-exit-code', '1', '--python-expr', 'import sys; sys.dont_write_bytecode = True',
      '--python', SCRIPT, '--', '--job', jobPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    const onData = (chunk) => {
      const text = chunk.toString();
      tail = (tail + text).slice(-6000);
      for (const line of text.split('\n')) {
        const ok = /^HK-OK (\S+)/.exec(line);
        if (ok) { done.push(ok[1]); console.log(`   ✓ ${ok[1]}`); }
        else if (/Error|Traceback/.test(line)) console.log(`   ${line}`);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (error) => reject(new Error(`No se pudo ejecutar Blender (${BLENDER}): ${error.message}`)));
    child.on('close', (code) => (code === 0 ? resolve(done) : reject(new Error(`Blender terminó con código ${code}:\n${tail}`))));
  });
}

/** Mismo fondo que las fotos de producto de la fábrica de muebles: degradado vertical claro y neutro. */
function background(width, height) {
  return Buffer.from(`<svg width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">`
    + '<stop offset="0" stop-color="#f6f4f0"/><stop offset="1" stop-color="#e7e4de"/></linearGradient></defs>'
    + '<rect width="100%" height="100%" fill="url(#g)"/></svg>');
}

/** Compone el render (con alfa y sombra de contacto) sobre el fondo, lo reduce y lo guarda en WebP. */
async function writePhoto(id) {
  const render = path.join(WORK_DIR, 'renders', `${id}.png`);
  const { width, height } = await sharp(render).metadata();
  const composed = await sharp(background(width, height)).composite([{ input: render }]).png().toBuffer();
  const resized = await sharp(composed).resize(PHOTO.width, PHOTO.height, { fit: 'cover', kernel: 'lanczos3' }).png().toBuffer();
  for (const quality of [92, 88, 84, 80]) {
    const webp = await sharp(resized).webp({ quality, effort: 6, smartSubsample: true }).toBuffer();
    if (webp.length <= MAX_PHOTO_BYTES || quality === 80) {
      await writeFile(path.join(OUT_DIR, `${id}.webp`), webp);
      return webp.length;
    }
  }
  throw new Error(`sin resultado al codificar ${id}`);
}

async function main() {
  const { only, samples, scale } = parseArgs(process.argv.slice(2));
  const renders = path.join(WORK_DIR, 'renders');
  // Se vacían los renders previos: si Blender falla a mitad no se reutiliza una imagen vieja.
  await rm(renders, { recursive: true, force: true });
  await Promise.all([mkdir(renders, { recursive: true }), mkdir(OUT_DIR, { recursive: true })]);
  const job = { scenes: only, samples, output: renders, textures: await resolveTextures(),
    size: [PHOTO.width * scale, PHOTO.height * scale] };
  const jobPath = path.join(WORK_DIR, 'job.json');
  await writeFile(jobPath, JSON.stringify(job, null, 2));
  console.log(`Renderizando ${only?.join(', ') ?? 'todas las escenas'} con Blender (${samples} muestras, ${job.size.join(' × ')} px)`);
  const started = Date.now();
  const done = await runBlender(jobPath);
  console.log(`   render terminado en ${Math.round((Date.now() - started) / 1000)} s`);
  const missing = (only ?? done).filter((id) => !done.includes(id) || !existsSync(path.join(renders, `${id}.png`)));
  if (missing.length || !done.length) throw new Error(`Blender no produjo el render de: ${missing.join(', ') || 'ninguna escena'}`);
  for (const id of done) {
    const bytes = await writePhoto(id);
    console.log(`   ${path.relative(ROOT, path.join(OUT_DIR, `${id}.webp`))} · ${(bytes / 1024).toFixed(1)} KB`);
  }
}

main().catch((error) => {
  console.error(`\n✖ ${error.message}`);
  process.exit(1);
});
