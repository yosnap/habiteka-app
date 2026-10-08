#!/usr/bin/env node
/**
 * Importa modelos CC0 de Poly Haven al catálogo 3D del editor (public/models/cc0).
 *
 * Por cada modelo: descarga el glTF 1K con sus texturas (verificando el MD5 que publica la API), lo deja estático
 * (sin esqueletos ni animaciones), corrige la orientación para que el frente mire a +Z, lo apoya en el suelo y lo
 * convierte en un único GLB (texturas WebP ≤ 1024 px y geometría meshopt, que el editor carga con useGLTF).
 * Después registra la procedencia en public/models/cc0/manifest.json. Poly Haven publica todo su contenido como CC0
 * (https://polyhaven.com/license). El alta en el catálogo se hace a mano en
 * src/lib/editor-document/furniture-assets.ts con las medidas que imprime este script.
 *
 * Uso:
 *   node scripts/import-polyhaven-models.mjs                    importa la selección curada que aún no exista
 *   node scripts/import-polyhaven-models.mjs sofa_02 sofa_03    importa solo esos modelos de la selección
 *   node scripts/import-polyhaven-models.mjs --force sofa_02    reimporta aunque el GLB ya exista
 *   node scripts/import-polyhaven-models.mjs id:clave[:giro]    importa un modelo fuera de la selección
 *   node scripts/import-polyhaven-models.mjs --list[=lighting]  lista candidatos de interior con sus medidas
 *   --dry-run                                                   optimiza sin escribir en public/ ni en el manifiesto
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compressDocument, createGltfIO, measureDocument } from './lib/glb-optimize.mjs';
import { MODELS_DIR, readModelManifest, upsertModelAsset, writeModelManifest } from './lib/model-manifest.mjs';

const API = 'https://api.polyhaven.com';
const USER_AGENT = 'habiteka-catalog-import/1.0 (+https://habiteka.app)';
const MAX_TEXTURE_PX = 1024;
const SIZE_BUDGET_BYTES = 2 * 1024 * 1024;
const INTERIOR_CATEGORIES = ['furniture', 'seating', 'table', 'shelves', 'bed', 'lighting', 'appliances', 'office', 'potted plants'];

/**
 * Selección curada. `kind` es la clave del catálogo (habiteka:asset:<kind>) y `rotationDeg` el giro en Y que deja el
 * frente del mueble mirando a +Z y su lado largo en X (convención del editor). `simplify` reduce la malla cuando el
 * GLB supera el presupuesto.
 */
const CURATED = [
  { id: 'bar_chair_round_01', kind: 'taburete_barra_madera' },
  { id: 'metal_stool_01', kind: 'taburete_barra_metal' },
  { id: 'metal_stool_03', kind: 'taburete_barra_respaldo' },
  { id: 'painted_wooden_nightstand', kind: 'mesilla_madera_cajon' },
  { id: 'side_table_01', kind: 'mesilla_estantes' },
  { id: 'side_table_tall_01', kind: 'velador_alto' },
  { id: 'vintage_wooden_drawer_01', kind: 'cajonera_baja_madera' },
  { id: 'industrial_pipe_lamp', kind: 'lampara_mesa_industrial' },
  // En reposo la pantalla apunta a -Z: se gira para que la pinza quede detrás y la luz delante.
  { id: 'desk_lamp_arm_01', kind: 'flexo_articulado', rotationDeg: 180 },
  { id: 'drawer_cabinet', kind: 'cajonera_alta_industrial' },
  { id: 'modern_wooden_cabinet', kind: 'aparador_bajo_moderno' },
  { id: 'vintage_cabinet_01', kind: 'aparador_vitrina_clasico' },
  { id: 'GothicCommode_01', kind: 'comoda_clasica' },
  { id: 'WoodenTable_03', kind: 'aparador_industrial' },
  { id: 'sofa_02', kind: 'sofa_chester_piel' },
  { id: 'sofa_03', kind: 'sofa_clasico_tapizado' },
  { id: 'mid_century_lounge_chair', kind: 'sillon_giratorio_piel' },
  { id: 'ArmChair_01', kind: 'butaca_clasica' },
  { id: 'Ottoman_01', kind: 'puf_piel' },
  { id: 'coffee_table_round_01', kind: 'mesa_centro_redonda' },
  { id: 'modern_coffee_table_02', kind: 'mesa_centro_cuadrada' },
  { id: 'round_wooden_table_01', kind: 'mesa_alta_redonda' },
  { id: 'round_wooden_table_02', kind: 'mesa_redonda_pequena' },
  { id: 'painted_wooden_table', kind: 'mesa_alta_rustica' },
  { id: 'painted_wooden_chair_01', kind: 'silla_comedor_blanca' },
  { id: 'GothicBed_01', kind: 'cama_doble_tallada' },
  { id: 'old_bed_frame', kind: 'cama_individual_hierro' },
  // Viene con el frente en X: se gira para que los cubos miren al frente y el lado largo quede en X.
  { id: 'wooden_display_shelves_01', kind: 'estanteria_cubos', rotationDeg: 90 },
  { id: 'steel_frame_shelves_03', kind: 'estanteria_acero_madera' },
  { id: 'metal_office_desk', kind: 'escritorio_metalico' },
  { id: 'electric_stove', kind: 'cocina_electrica_horno' },
  { id: 'potted_plant_02', kind: 'planta_maceta_barro' },
  { id: 'potted_plant_04', kind: 'aloe_maceta' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const md5 = (buffer) => createHash('md5').update(buffer).digest('hex');
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

async function request(url) {
  const { protocol, hostname } = new URL(url);
  if (protocol !== 'https:' || !/(^|\.)polyhaven\.(com|org)$/.test(hostname)) throw new Error(`URL no permitida: ${url}`);
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status} en ${url}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error;
    }
    await sleep(800 * attempt);
  }
  throw lastError;
}

const fetchJson = async (url) => (await request(url)).json();

async function download(url, destination, expectedMd5) {
  const buffer = Buffer.from(await (await request(url)).arrayBuffer());
  if (expectedMd5 && md5(buffer) !== expectedMd5) throw new Error(`MD5 distinto en ${url}`);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, buffer);
}

/** Descarga el .gltf 1K y sus recursos en un directorio temporal, sin permitir rutas fuera de él. */
async function downloadGltf(id, directory) {
  const files = await fetchJson(`${API}/files/${encodeURIComponent(id)}`);
  const gltf = files?.gltf?.['1k']?.gltf;
  if (!gltf?.url) throw new Error(`${id} no tiene glTF 1K`);
  for (const [relative, file] of Object.entries(gltf.include ?? {})) {
    const destination = path.resolve(directory, relative);
    if (!destination.startsWith(directory + path.sep)) throw new Error(`Ruta de recurso no válida: ${relative}`);
    await download(file.url, destination, file.md5);
  }
  const main = path.join(directory, `${id}.gltf`);
  await download(gltf.url, main, gltf.md5);
  return main;
}

/** El editor clona la escena sin re-enlazar huesos: los muebles se importan estáticos, en su pose de reposo. */
function makeStatic(document) {
  const root = document.getRoot();
  root.listAnimations().forEach((animation) => animation.dispose());
  root.listNodes().forEach((node) => node.getSkin() && node.setSkin(null));
  root.listSkins().forEach((skin) => skin.dispose());
  for (const mesh of root.listMeshes()) for (const primitive of mesh.listPrimitives()) {
    for (const semantic of primitive.listSemantics()) {
      if (/^(JOINTS|WEIGHTS)_\d+$/.test(semantic)) primitive.setAttribute(semantic, null);
    }
  }
}

/** Gira toda la escena alrededor de Y para que el frente mire a +Z. */
function orient(document, rotationDeg) {
  if (!rotationDeg) return;
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
  const half = (rotationDeg * Math.PI) / 360;
  const pivot = document.createNode('orientacion').setRotation([0, Math.sin(half), 0, Math.cos(half)]);
  for (const child of scene.listChildren()) { scene.removeChild(child); pivot.addChild(child); }
  scene.addChild(pivot);
}

async function optimize(io, source, entry) {
  const document = await io.read(source);
  makeStatic(document);
  orient(document, entry.rotationDeg ?? 0);
  await compressDocument(document, { maxTexturePx: MAX_TEXTURE_PX, simplifyRatio: entry.simplify });
  return { glb: Buffer.from(await io.writeBinary(document)), dimensionsMm: measureDocument(document) };
}

async function importModel(io, manifest, entry, { force, dryRun }) {
  if (!/^[A-Za-z0-9_]+$/.test(entry.id) || !/^[a-z0-9_]+$/.test(entry.kind)) throw new Error(`Id o clave no válidos: ${entry.id}/${entry.kind}`);
  const file = `${entry.id.toLowerCase()}.glb`, destination = path.join(MODELS_DIR, file);
  if (existsSync(destination) && !force) return console.log(`⏭  ${file} ya existe (usa --force para reimportarlo)`);
  const info = await fetchJson(`${API}/info/${encodeURIComponent(entry.id)}`);
  if (info?.type !== 2 || typeof info.name !== 'string') throw new Error(`${entry.id} no es un modelo de Poly Haven`);
  const directory = await mkdtemp(path.join(os.tmpdir(), 'polyhaven-'));
  try {
    const { glb, dimensionsMm } = await optimize(io, await downloadGltf(entry.id, directory), entry);
    if (!dimensionsMm.every((value) => Number.isFinite(value) && value > 0)) throw new Error(`${entry.id} sin dimensiones válidas`);
    const published = [...(info.dimensions ?? [])].map(Math.round).sort((a, b) => a - b);
    const measured = [...dimensionsMm].sort((a, b) => a - b);
    if (published.length === 3 && measured.some((value, axis) => Math.abs(value - published[axis]) > Math.max(10, published[axis] * .05))) {
      console.warn(`   ⚠  ${entry.id}: medidas ${dimensionsMm.join('×')} mm distintas de las publicadas ${published.join('×')} mm`);
    }
    if (glb.length > SIZE_BUDGET_BYTES) console.warn(`   ⚠  ${file} pesa ${(glb.length / 1048576).toFixed(2)} MB (presupuesto 2 MB): prueba con simplify`);
    const asset = {
      file, kind: entry.kind, source: `polyhaven.com/a/${entry.id} (${info.name}; 1K glTF optimized to GLB)`,
      author: Object.keys(info.authors ?? {}).join(', ') || 'Poly Haven', license: 'CC0-1.0', attributionRequired: false,
      sha256: sha256(glb), polyhavenId: entry.id, title: info.name, sourceUrl: `https://polyhaven.com/a/${entry.id}`,
      importedAt: new Date().toISOString().slice(0, 10), dimensionsMm,
    };
    if (!dryRun) { await writeFile(destination, glb); upsertModelAsset(manifest, asset); }
    const [width, depth, height] = dimensionsMm;
    console.log(`✓ ${entry.kind.padEnd(26)} ${file.padEnd(32)} ${width}×${depth}×${height} mm  ${(glb.length / 1024).toFixed(0)} KB`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function list(category) {
  const assets = await fetchJson(`${API}/assets?type=models${category ? `&categories=${encodeURIComponent(category)}` : ''}`);
  const rows = Object.entries(assets)
    .filter(([, asset]) => category || asset.categories?.some((name) => INTERIOR_CATEGORIES.includes(name)))
    .map(([id, asset]) => [asset.category ?? '', id, asset.name, (asset.dimensions ?? []).map(Math.round).join('×'), asset.polycount])
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  for (const row of rows) console.log(row.join(' | '));
  console.log(`\n${rows.length} modelos (medidas X×Y×Z publicadas en mm; la orientación real se mide al importar).`);
}

function selection(args) {
  const ids = args.filter((arg) => !arg.startsWith('--'));
  if (!ids.length) return CURATED;
  return ids.map((arg) => {
    const [id, kind, rotation] = arg.split(':');
    const curated = CURATED.find((entry) => entry.id === id);
    if (curated && !kind) return curated;
    if (!kind) throw new Error(`${id} no está en la selección curada: usa id:clave[:giroGrados]`);
    const rotationDeg = rotation === undefined ? 0 : Number(rotation);
    if (!Number.isFinite(rotationDeg)) throw new Error(`Giro no válido para ${id}: ${rotation}`);
    return { id, kind, rotationDeg };
  });
}

async function main() {
  const args = process.argv.slice(2);
  const listArg = args.find((arg) => arg === '--list' || arg.startsWith('--list='));
  if (listArg) return list(listArg.split('=')[1]);
  const options = { force: args.includes('--force'), dryRun: args.includes('--dry-run') };
  const io = await createGltfIO();
  const manifest = await readModelManifest();
  const failures = [];
  for (const entry of selection(args)) {
    try {
      await importModel(io, manifest, entry, options);
    } catch (error) {
      failures.push(entry.id);
      console.error(`✗ ${entry.id}: ${error instanceof Error ? error.message : error}`);
    }
  }
  if (!options.dryRun) await writeModelManifest(manifest);
  if (failures.length) {
    console.error(`\nFallaron ${failures.length}: ${failures.join(', ')}`);
    process.exitCode = 1;
  }
  console.log('\nAñade o actualiza cada clave en src/lib/editor-document/furniture-assets.ts con ancho × fondo × alto.');
}

main().catch((error) => { console.error(error); process.exit(1); });
