#!/usr/bin/env node
/**
 * Descarga modelos 3D CC0 de Poly Pizza para el catálogo 3D de Habiteka.
 *
 * Uso:
 *   POLY_PIZZA_KEY=tu_api_key node scripts/download-poly-pizza-models.mjs
 *
 * API key gratuita en: https://poly.pizza/me/settings (crear cuenta → crear app)
 *
 * El script busca los modelos que faltan en el catálogo, muestra las opciones
 * disponibles y descarga el mejor match CC0 de Quaternius/Kenney.
 */

import { createWriteStream, existsSync } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const API_KEY = process.env.POLY_PIZZA_KEY;
const BASE_URL = 'https://api.poly.pizza/v1.1';
const MODELS_DIR = fileURLToPath(new URL('../public/models/cc0/', import.meta.url));

if (!API_KEY) {
  console.error('❌  Falta POLY_PIZZA_KEY. Consíguela gratis en https://poly.pizza/me/settings');
  process.exit(1);
}

/**
 * Modelos que queremos descargar.
 * `skipIfTitleContains`: descarta resultados cuyo título contenga estas palabras
 * (evita que una búsqueda devuelva el modelo equivocado).
 */
const WANTED = [
  { keyword: 'bidet',       output: 'bidet',     preferAuthor: 'Quaternius', skipIfTitleContains: ['toilet', 'sink'] },
  { keyword: 'floor lamp',  output: 'lampara',   preferAuthor: 'Quaternius' },
  { keyword: 'fireplace',   output: 'chimenea',  preferAuthor: 'Quaternius' },
  { keyword: 'laptop',      output: 'ordenador', preferAuthor: 'Kenney' },
  { keyword: 'rug',         output: 'alfombra',  preferAuthor: 'Kenney' },
  { keyword: 'counter',     output: 'isla',      preferAuthor: 'Kenney', skipIfTitleContains: ['fridge', 'sink', 'microwave'] },
];

async function apiFetch(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { headers: { 'x-auth-token': API_KEY } });
  if (!res.ok) throw new Error(`API ${res.status} en ${url}`);
  return res.json();
}

/** Busca modelos CC0 por keyword y los ordena: primero el autor preferido. */
async function search(keyword, preferAuthor) {
  const encoded = encodeURIComponent(keyword);
  // License=1 → solo CC0
  const data = await apiFetch(`/search/${encoded}?License=1&Limit=32`);
  const results = data.results ?? [];
  return results.sort((a, b) => {
    const aMatch = a.Creator?.Username === preferAuthor ? -1 : 0;
    const bMatch = b.Creator?.Username === preferAuthor ? -1 : 0;
    return aMatch - bMatch;
  });
}

/** Descarga un .glb a disco desde la URL directa del campo Download. */
async function downloadGlb(downloadUrl, outputPath) {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Descarga fallida: ${res.status} ${downloadUrl}`);
  await pipeline(res.body, createWriteStream(outputPath));
}

/** Lista todos los modelos de un autor (todas las páginas). */
async function listAllByAuthor(username) {
  const all = [];
  let page = 0;
  while (true) {
    const data = await apiFetch(`/user/${username}?Limit=32&Page=${page}`);
    const models = data.Models ?? [];
    all.push(...models);
    if (models.length < 32) break;
    page++;
  }
  return all;
}

async function main() {
  const args = process.argv.slice(2);

  // Modo --list-author=Quaternius: muestra todos los modelos de un autor
  const listArg = args.find(a => a.startsWith('--list-author='));
  if (listArg) {
    const author = listArg.split('=')[1];
    console.log(`\n📋  Modelos CC0 de ${author} en Poly Pizza:\n`);
    const models = await listAllByAuthor(author);
    for (const m of models) {
      console.log(`  ${m.ID}  ${m.Title}  [${m.Licence}]`);
    }
    console.log(`\nTotal: ${models.length} modelos`);
    return;
  }

  // Modo por defecto: busca y descarga los modelos de WANTED
  for (const { keyword, output, preferAuthor } of WANTED) {
    const outPath = path.join(MODELS_DIR, `${output}.glb`);
    if (existsSync(outPath)) {
      console.log(`⏭  ${output}.glb ya existe, saltando`);
      continue;
    }

    console.log(`\n🔍  Buscando "${keyword}" (preferido: ${preferAuthor})...`);
    let results;
    try {
      results = await search(keyword, preferAuthor);
    } catch (e) {
      console.error(`   ✗ Error en búsqueda: ${e.message}`);
      continue;
    }

    const entry = WANTED.find(w => w.output === output);
    const skipTerms = entry?.skipIfTitleContains ?? [];
    const filtered = results.filter(r =>
      !skipTerms.some(s => (r.Title ?? '').toLowerCase().includes(s.toLowerCase()))
    );

    if (!filtered.length) {
      console.log(`   ⚠  Sin resultados válidos (${results.length} descartados por filtro: ${skipTerms.join(', ')})`);
      continue;
    }

    const best = filtered[0];
    console.log(`   → ${best.Title} por ${best.Creator?.Username} [${best.Licence}]`);
    console.log(`      poly.pizza/m/${best.ID}`);

    if (!best.Download) {
      console.log(`   ⚠  Sin URL de descarga disponible`);
      continue;
    }

    try {
      await downloadGlb(best.Download, outPath);
      const { execSync } = await import('child_process');
      const hash = execSync(`shasum -a 256 "${outPath}"`).toString().split(' ')[0];
      console.log(`   ✓ Descargado → ${output}.glb (sha256: ${hash})`);
      console.log(`   📝 Añade a furniture-models.ts:`);
      console.log(`      ${output}: { url: '/models/cc0/${output}.glb' },`);
      console.log(`   📝 Añade a manifest.json:`);
      console.log(`      { "file": "${output}.glb", "kind": "${output}", "source": "poly.pizza/m/${best.ID} (${best.Title})", "author": "${best.Creator?.Username}", "license": "CC0-1.0", "attributionRequired": false, "sha256": "${hash}" }`);
    } catch (e) {
      console.error(`   ✗ Error al descargar: ${e.message}`);
    }
  }

  console.log('\n✅  Listo. Revisa los mensajes anteriores para actualizar furniture-models.ts y manifest.json.');
}

main().catch(e => { console.error(e); process.exit(1); });
