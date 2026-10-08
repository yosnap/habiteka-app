#!/usr/bin/env node
/**
 * Fábrica de muebles propios de Habiteka: genera con Blender (sin interfaz) los modelos 3D paramétricos definidos en
 * scripts/furniture-factory/specs-*.mjs, los optimiza para el editor y registra catálogo, miniaturas y procedencia.
 *
 * Por pieza: Blender construye la geometría (scripts/blender/), exporta un GLB y renderiza con Cycles una foto de
 * producto. Aquí se optimiza el GLB (meshopt + texturas WebP, igual que el importador de Poly Haven), se comprueban
 * los presupuestos (≤ 40 000 triángulos y ≤ 1,5 MB por modelo; ≤ MAX_TOTAL_MB en total) y se guarda la miniatura WebP.
 * Al final se reescriben public/models/habiteka/manifest/<familia>.json (procedencia), catalog.json (registro de la app,
 * con todas las familias) y las hojas de contacto de cada familia en plans/reports/. Las familias se descubren solas en
 * scripts/furniture-factory/families/*.mjs (ver catalog-specs.mjs); dos familias distintas pueden generarse a la vez.
 *
 * Uso:
 *   node scripts/build-furniture-factory.mjs                         genera las piezas nuevas o cambiadas
 *   node scripts/build-furniture-factory.mjs --only=sofas,camas      solo esas familias, productos o piezas
 *   node scripts/build-furniture-factory.mjs --only=sofa_moderno_3p  una pieza concreta
 *   --force     regenera aunque la pieza esté al día (misma especificación y mismo código del generador)
 *   --dry-run   valida las especificaciones y muestra qué se generaría, sin llamar a Blender ni escribir nada
 *   --samples=N muestras de Cycles para la foto (96 por defecto)
 * Variable BLENDER: ruta del ejecutable (por defecto /Applications/Blender.app/Contents/MacOS/Blender).
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Logger } from '@gltf-transform/core';
import sharp from 'sharp';
import { compressDocument, createGltfIO, measureDocument, measureElevation, triangleCount } from './lib/glb-optimize.mjs';
import { GENERATOR_VERSION, buildLibrary, expandSpecs, loadFamilies, selectPieces } from './furniture-factory/catalog-specs.mjs';
import { writeContactSheets } from './furniture-factory/contact-sheets.mjs';
import { AUTHOR, LICENSE, OUT_DIR, THUMBS_DIR, readManifest, writeManifest, writeRegistry } from './furniture-factory/registry.mjs';
import { resolveFinish, textureProvenance } from './furniture-factory/textures-prepare.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const BLENDER_DIR = path.join(ROOT, 'scripts/blender');
const BLENDER = process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender';
const WORK_DIR = path.join(os.tmpdir(), 'habiteka-furniture-factory');
const REPORTS_DIR = path.join(ROOT, 'plans/reports');
/**
 * Límite propio (no técnico) del peso total de public/models/habiteka: cada modelo se descarga solo cuando se usa, pero
 * todo viaja en el repositorio. Si el catálogo sigue creciendo, los modelos deberían ir al almacenamiento de objetos.
 */
const MAX_TOTAL_MB = 200;
const MAX_TRIANGLES = 40_000, MAX_BYTES = 1.5 * 1024 * 1024, MAX_TOTAL_BYTES = MAX_TOTAL_MB * 1024 * 1024, BATCH = 10;
/** Por debajo de esta cota (mm) el hueco bajo la pieza es ruido de biseles o patas abiertas: la pieza va en el suelo. */
const ELEVATION_NOISE_MM = 5;

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

function parseArgs(argv) {
  const value = (name) => argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
  const known = ['--force', '--dry-run'];
  const unknown = argv.filter((arg) => !known.includes(arg) && !/^--(only|samples)=/.test(arg));
  if (unknown.length) throw new Error(`Argumentos desconocidos: ${unknown.join(' ')}`);
  const samples = Number(value('samples') ?? 96);
  if (!Number.isInteger(samples) || samples < 8 || samples > 1024) throw new Error('--samples debe ser un entero entre 8 y 1024');
  return { only: value('only')?.split(',').filter(Boolean), force: argv.includes('--force'), dryRun: argv.includes('--dry-run'), samples };
}

/**
 * Huella del código que genera una familia: módulos comunes (hk_*.py, factory_main.py), su fam_<familia>.py y los de
 * las familias de las que depende. Cambiar el módulo de otra familia no deja desfasadas las demás.
 */
async function generatorHash(family) {
  const files = (await readdir(BLENDER_DIR)).filter((file) => /^(hk_.*|factory_main)\.py$/.test(file)).sort()
    .concat([family.id, ...(family.dependsOn ?? [])].map((id) => `fam_${id}.py`));
  const contents = await Promise.all(files.map(async (file) => {
    if (!existsSync(path.join(BLENDER_DIR, file))) throw new Error(`Falta scripts/blender/${file} para la familia ${family.id}`);
    return readFile(path.join(BLENDER_DIR, file));
  }));
  return sha256(Buffer.concat([Buffer.from(GENERATOR_VERSION), ...contents]));
}

/**
 * Huella de una pieza: especificación, código de su familia, acabados y la definición de cada textura (fuente e id).
 * La cota de encimera (counterMm) es un dato del registro que no cambia la geometría: no regenera la pieza.
 */
const specHash = ({ counterMm: _counter, ...piece }, codeHash, library) => sha256(JSON.stringify({ piece, codeHash, finishes: Object.fromEntries(
  Object.values(piece.finishes).map((name) => {
    const finish = library.finishes[name];
    return [name, { ...finish, textureSource: finish.texture ? library.textures[finish.texture] : undefined }];
  })) }));

function runBlender(jobPath) {
  return new Promise((resolve, reject) => {
    // dont_write_bytecode: los módulos de scripts/blender no dejan cachés .pyc en el repositorio.
    const child = spawn(BLENDER, ['-b', '--factory-startup', '--python-expr', 'import sys; sys.dont_write_bytecode = True',
      '--python', path.join(BLENDER_DIR, 'factory_main.py'), '--', '--job', jobPath],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    const onData = (chunk) => {
      const text = chunk.toString();
      tail = (tail + text).slice(-4000);
      for (const line of text.split('\n')) if (/^HK-|Error|Traceback/.test(line)) console.log(`   ${line}`);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (error) => reject(new Error(`No se pudo ejecutar Blender (${BLENDER}): ${error.message}`)));
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Blender terminó con código ${code}:\n${tail}`))));
  });
}

/**
 * Optimiza el GLB bajando el tamaño de textura hasta cumplir el presupuesto. Devuelve también la elevación: `dims` es
 * el tamaño visible y la cota del hueco de debajo (piezas colgadas) sale de la geometría construida a su altura real.
 */
async function optimize(io, rawPath, maxTexturePx, id) {
  const raw = await readFile(rawPath);
  const lowest = measureElevation(await io.readBinary(raw));
  if (lowest < -ELEVATION_NOISE_MM) console.warn(`   ⚠  ${id}: baja ${-lowest} mm por debajo del suelo`);
  const elevationMm = lowest > ELEVATION_NOISE_MM ? lowest : 0;
  for (const px of [maxTexturePx, 768, 512].filter((size) => size <= maxTexturePx)) {
    const document = await compressDocument(await io.readBinary(raw), { maxTexturePx: px });
    const glb = Buffer.from(await io.writeBinary(document));
    if (glb.length <= MAX_BYTES || px === 512) return { glb, document, texturePx: px, elevationMm };
  }
  throw new Error('optimización sin resultado');
}

async function thumbnail(pngPath) {
  const { width, height } = await sharp(pngPath).metadata();
  const background = Buffer.from(`<svg width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f4f0"/><stop offset="1" stop-color="#e7e4de"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
  // sharp redimensiona antes de componer: primero se compone a tamaño completo y después se reduce.
  const composed = await sharp(background).composite([{ input: pngPath }]).png().toBuffer();
  return sharp(composed).resize(512, 384).webp({ quality: 84 }).toBuffer();
}

async function finishPiece(io, piece, result, manifest, codeHash, library) {
  const { glb, document, texturePx, elevationMm } = await optimize(io, result.glb, piece.textureSize, piece.id);
  const triangles = triangleCount(document), dimensionsMm = measureDocument(document);
  if (triangles > MAX_TRIANGLES) throw new Error(`${triangles} triángulos (máximo ${MAX_TRIANGLES})`);
  if (glb.length > MAX_BYTES) throw new Error(`${(glb.length / 1048576).toFixed(2)} MB (máximo 1,5 MB)`);
  if (!result.png || !existsSync(result.png)) throw new Error('falta la foto de producto');
  const off = dimensionsMm.map((value, axis) => value - piece.dims[axis]);
  if (off.some((delta, axis) => Math.abs(delta) > Math.max(30, piece.dims[axis] * .04))) {
    console.warn(`   ⚠  ${piece.id}: mide ${dimensionsMm.join('×')} mm, especificado ${piece.dims.join('×')} mm`);
  }
  const file = `${piece.id}.glb`, thumb = `thumbs/${piece.id}.webp`;
  await writeFile(path.join(OUT_DIR, file), glb);
  await writeFile(path.join(OUT_DIR, thumb), await thumbnail(result.png));
  const textures = [...new Set(Object.values(piece.finishes).map((name) => library.finishes[name].texture).filter(Boolean))].sort();
  for (const key of textures) manifest.textures[key] ??= await textureProvenance(key, library);
  manifest.models[piece.id] = {
    file, thumbnail: thumb, sha256: sha256(glb), bytes: glb.length, triangles, texturePx, dimensionsMm, elevationMm,
    specDimensionsMm: piece.dims, family: piece.family, type: piece.type, params: piece.params, finishes: piece.finishes,
    textures, author: AUTHOR, license: LICENSE, generatorVersion: GENERATOR_VERSION, specHash: specHash(piece, codeHash, library),
    builtAt: new Date().toISOString().slice(0, 10),
  };
  console.log(`✓ ${piece.id.padEnd(40)} ${dimensionsMm.join('×').padEnd(16)} ${String(triangles).padStart(6)} tri ${(glb.length / 1024).toFixed(0).padStart(5)} KB${elevationMm ? ` a ${elevationMm} mm del suelo` : ''}`);
}

async function totalBytes() {
  let total = 0;
  for (const dir of [OUT_DIR, THUMBS_DIR]) {
    for (const file of await readdir(dir)) if (/\.(glb|webp)$/.test(file)) total += (await stat(path.join(dir, file))).size;
  }
  return total;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const families = await loadFamilies();
  const library = buildLibrary(families);
  const pieces = expandSpecs(families, library);
  const selected = selectPieces(pieces, options.only);
  const ids = families.map((family) => family.id);
  const manifests = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await readManifest(id)])));
  // Solo las familias seleccionadas: otra familia a medio escribir (sin su fam_*.py) no bloquea esta ejecución.
  const selectedFamilies = families.filter((family) => selected.some((piece) => piece.family === family.id));
  const codeHashes = Object.fromEntries(await Promise.all(selectedFamilies.map(async (family) => [family.id, await generatorHash(family)])));
  const fresh = (piece) => manifests[piece.family].models[piece.id]?.specHash === specHash(piece, codeHashes[piece.family], library)
    && existsSync(path.join(OUT_DIR, `${piece.id}.glb`)) && existsSync(path.join(THUMBS_DIR, `${piece.id}.webp`));
  const todo = selected.filter((piece) => options.force || !fresh(piece));
  console.log(`${pieces.length} piezas especificadas (${ids.map((id) => `${id}: ${pieces.filter((piece) => piece.family === id).length}`).join(', ')}); ${todo.length} por generar.`);
  if (options.dryRun) {
    for (const piece of todo) console.log(`  · ${piece.id} (${piece.family}/${piece.type}, ${piece.dims.join('×')} mm)`);
    return;
  }
  // Directorio de trabajo propio de esta ejecución: otra familia puede estar generándose a la vez.
  const runDir = path.join(WORK_DIR, `run-${process.pid}`);
  await Promise.all([mkdir(THUMBS_DIR, { recursive: true }), mkdir(runDir, { recursive: true })]);
  const io = await createGltfIO(Logger.Verbosity.ERROR);
  const failures = [];
  try {
    for (let start = 0; start < todo.length; start += BATCH) {
      const batch = todo.slice(start, start + BATCH);
      const outDir = path.join(runDir, 'out'), jobPath = path.join(runDir, 'job.json'), resultsPath = path.join(runDir, 'results.json');
      await rm(resultsPath, { force: true });
      const jobPieces = [];
      for (const piece of batch) {
        const finishes = {};
        for (const [slot, name] of Object.entries(piece.finishes)) finishes[slot] = await resolveFinish(name, WORK_DIR, library);
        jobPieces.push({ ...piece, finishes });
      }
      await writeFile(jobPath, JSON.stringify({ outDir, results: resultsPath, samples: options.samples, pieces: jobPieces }));
      console.log(`\nBlender: piezas ${start + 1}–${start + batch.length} de ${todo.length}`);
      try {
        await runBlender(jobPath);
      } catch (error) {
        console.error(`✗ ${error.message}`);
      }
      const results = existsSync(resultsPath) ? JSON.parse(await readFile(resultsPath, 'utf8')) : [];
      for (const piece of batch) {
        const result = results.find((item) => item.id === piece.id);
        try {
          if (!result) throw new Error('Blender no devolvió resultado');
          if (!result.ok) throw new Error(result.error);
          await finishPiece(io, piece, result, manifests[piece.family], codeHashes[piece.family], library);
        } catch (error) {
          failures.push(piece.id);
          console.error(`✗ ${piece.id}: ${error instanceof Error ? error.message : error}`);
        }
      }
      for (const family of new Set(batch.map((piece) => piece.family))) await writeManifest(family, manifests[family], GENERATOR_VERSION);
    }
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
  // Piezas retiradas o renombradas: solo las que el manifiesto de una familia de esta ejecución registra y su
  // especificación ya no contiene. Nunca se tocan archivos de otras familias (pueden estar generándose a la vez).
  const known = new Set(pieces.map((piece) => piece.id));
  for (const family of new Set(selected.map((piece) => piece.family))) {
    const retired = Object.keys(manifests[family].models).filter((id) => !known.has(id));
    for (const id of retired) {
      await rm(path.join(OUT_DIR, `${id}.glb`), { force: true });
      await rm(path.join(THUMBS_DIR, `${id}.webp`), { force: true });
      delete manifests[family].models[id];
      console.log(`Retirada ${id}: ya no está en families/${family}.mjs`);
    }
    if (retired.length) await writeManifest(family, manifests[family], GENERATOR_VERSION);
  }
  // El registro se compone con las especificaciones y familias que hay en disco AHORA, no con las del arranque: otra
  // ejecución en paralelo (u otra persona) puede haber añadido piezas o familias mientras esta trabajaba, y con la foto
  // inicial las dejaría fuera de catalog.json.
  const current = await loadFamilies({ fresh: true });
  const entries = await writeRegistry(expandSpecs(current, buildLibrary(current)), current.map((family) => family.id));
  const collisionIds = todo.filter((piece) => ['table', 'chair', 'bench'].includes(piece.profile) && !failures.includes(piece.id)).map((piece) => piece.id);
  if (collisionIds.length) await new Promise((resolve, reject) => {
    const child = spawn('bun', ['run', path.join(ROOT, 'scripts/build-furniture-collision-proxies.ts'), `--only=${collisionIds.join(',')}`],
      { cwd: ROOT, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`No se pudieron actualizar los sólidos de colisión (${code})`)));
  });
  const sheets = await writeContactSheets(pieces, REPORTS_DIR, [...new Set(selected.map((piece) => piece.family))]);
  const total = await totalBytes();
  console.log(`\nRegistro: ${entries.length} piezas en el catálogo. Peso total: ${(total / 1048576).toFixed(1)} MB.`);
  for (const sheet of sheets) console.log(`Hoja de contacto: ${path.relative(ROOT, sheet)}`);
  if (total > MAX_TOTAL_BYTES) {
    console.error(`✗ El total supera el presupuesto de ${MAX_TOTAL_MB} MB (MAX_TOTAL_MB)`);
    process.exitCode = 1;
  }
  if (failures.length) {
    console.error(`\nFallaron ${failures.length}: ${failures.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
