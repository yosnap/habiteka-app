#!/usr/bin/env node
/**
 * Genera las alfombras realistas del catálogo (public/models/cc0/alfombra_*.glb) a partir de texturas CC0 de tela,
 * moqueta y fibra de ambientCG y Poly Haven.
 *
 * Cada alfombra es una losa de 10 mm (cara superior y cantos, sin cara inferior) con color, normal y rugosidad
 * horneados a su tamaño real: la textura CC0 se repite a su escala física y, según el diseño, se le añade un dibujo
 * vectorial propio (rombos bereberes, kilim, rayas, espiral trenzada), un ajuste de color y un ribete. Las texturas van en WebP dentro del
 * GLB (≤ 1024 px). La procedencia se registra en public/models/cc0/manifest.json (campo cc0Texture) y el alta en el
 * catálogo está en src/lib/editor-document/furniture-assets.ts. El resultado es determinista: regenerar da lo mismo.
 *
 * Uso:
 *   node scripts/build-cc0-rugs.mjs                       genera las alfombras que falten
 *   node scripts/build-cc0-rugs.mjs --force [claves…]     las regenera (todas o solo esas claves)
 *   --dry-run                                             genera sin escribir en public/ ni en el manifiesto
 */
import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Document, Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
import { cc0Material, sha256 } from './lib/cc0-sources.mjs';
import { MODELS_DIR, readModelManifest, upsertModelAsset, writeModelManifest } from './lib/model-manifest.mjs';

const HEIGHT_MM = 10, TEXTURE_PX = 1024, ROUND_SEGMENTS = 96;
/** Tamaños rectangulares en cm (fondo × ancho); en el editor el lado largo va en X. */
const RECT_SIZES_CM = [[140, 200], [160, 230], [200, 300]];

/**
 * Diseños. `texture`: material CC0 de base y su escala real (mm por repetición). `detail`: cuánto relieve de la
 * textura se conserva sobre el dibujo propio. `grade`: brillo y saturación de la textura (sharp.modulate).
 * `border`: ribete oscurecido (multiplicar) de ese ancho en mm.
 */
const DESIGNS = [
  { key: 'lana_beige', texture: ['ambientcg', 'Carpet016'], tileMm: 1700, grade: { saturation: .85, brightness: .88 },
    border: { mm: 25, color: '#8f7d68', opacity: .45 } },
  { key: 'gris', texture: ['ambientcg', 'Fabric031'], tileMm: 500, border: { mm: 25, color: '#4d4d4d', opacity: .4 } },
  { key: 'pelo_largo', texture: ['polyhaven', 'curly_teddy_natural'], tileMm: 336, grade: { saturation: .9, brightness: .86 } },
  { key: 'bereber', texture: ['ambientcg', 'Carpet014'], tileMm: 400, pattern: bereber, detail: 34 },
  { key: 'kilim', texture: ['ambientcg', 'Fabric019'], tileMm: 300, pattern: kilim, detail: 30 },
  { key: 'geometrica', texture: ['ambientcg', 'Carpet008'], tileMm: 1200, border: { mm: 60, color: '#a58c66', opacity: .35 } },
  { key: 'yute', texture: ['ambientcg', 'Wicker011A'], tileMm: 400, border: { mm: 45, color: '#3f3122', opacity: .78 } },
  { key: 'rayas', texture: ['ambientcg', 'Fabric019'], tileMm: 300, pattern: stripes, detail: 30 },
];
const ROUND = [
  { key: 'redonda_yute', design: 'yute', diameterMm: 1600, overlay: braidRings },
  { key: 'redonda_pelo', design: 'pelo_largo', diameterMm: 2000 },
];

/** PRNG determinista (LCG): la misma alfombra sale idéntica en cada ejecución. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; };
}
const svg = (width, height, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`);
const points = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** Bereber (Beni Ourain): fondo crudo con una retícula de rombos de trazo oscuro e irregular, tejida a mano. */
function bereber(width, height, k) {
  const random = seeded(11), cell = 430 * k, tall = 640 * k, slope = cell / tall, lines = [];
  for (const direction of [1, -1]) {
    for (let x0 = -height * slope - cell; x0 < width + height * slope + cell; x0 += cell) {
      const path = [];
      for (let y = -20 * k; y <= height + 20 * k; y += 35 * k) path.push([x0 + direction * y * slope + (random() - .5) * 7 * k, y]);
      lines.push(`<polyline points="${points(path)}" fill="none" stroke="#3b2d23" stroke-width="${(11 + random() * 5) * k}" stroke-linejoin="round" stroke-opacity=".88"/>`);
    }
  }
  return svg(width, height, `<rect width="100%" height="100%" fill="#ece5d8"/>${lines.join('')}`);
}

/** Kilim: campo terracota con rombos escalonados, cenefa azul noche con zigzag crudo. */
function kilim(width, height, k) {
  const band = Math.min(width, height) * .1, inner = [band, band, width - 2 * band, height - 2 * band];
  const zigzag = (x1, y1, x2, y2, amplitude, period) => {
    const length = Math.hypot(x2 - x1, y2 - y1), steps = Math.max(2, Math.round(length / period)), ux = (x2 - x1) / length, uy = (y2 - y1) / length;
    return `<polyline points="${points(Array.from({ length: steps + 1 }, (_, i) => {
      const t = i * length / steps, offset = (i % 2 ? 1 : -1) * amplitude;
      return [x1 + ux * t - uy * offset, y1 + uy * t + ux * offset];
    }))}" fill="none" stroke="#efe4cc" stroke-width="${18 * k}" stroke-linejoin="miter"/>`;
  };
  const mid = band / 2, amp = band * .22, period = band * .55;
  const border = [zigzag(mid, mid, width - mid, mid, amp, period), zigzag(mid, height - mid, width - mid, height - mid, amp, period),
    zigzag(mid, mid, mid, height - mid, amp, period), zigzag(width - mid, mid, width - mid, height - mid, amp, period)].join('');
  const count = Math.max(2, Math.round(inner[2] / (inner[3] * .8))), step = inner[2] / count;
  const diamond = (cx, cy, hw, hh, color) => `<polygon points="${points([[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]])}" fill="${color}"/>`;
  const motifs = Array.from({ length: count }, (_, i) => {
    const cx = inner[0] + step * (i + .5), cy = height / 2, hw = step * .44, hh = inner[3] * .42;
    return [['#26344b', 1], ['#efe4cc', .74], ['#c58f2c', .5], ['#a3462b', .3], ['#26344b', .14]]
      .map(([color, scale]) => diamond(cx, cy, hw * scale, hh * scale, color)).join('');
  }).join('');
  const ticks = Array.from({ length: count + 1 }, (_, i) => {
    const cx = inner[0] + step * i, size = Math.min(step, inner[3]) * .09;
    return [height / 2 - inner[3] * .3, height / 2 + inner[3] * .3].map((cy) => diamond(cx, cy, size, size * 1.4, '#efe4cc')).join('');
  }).join('');
  return svg(width, height, `<rect width="100%" height="100%" fill="#26344b"/><rect x="${inner[0]}" y="${inner[1]}" width="${inner[2]}" height="${inner[3]}" fill="#a3462b"/>`
    + `<rect x="${inner[0] - 10 * k}" y="${inner[1] - 10 * k}" width="${inner[2] + 20 * k}" height="${inner[3] + 20 * k}" fill="none" stroke="#c58f2c" stroke-width="${12 * k}"/>${border}${motifs}${ticks}`);
}

/** Rayas: fondo crudo con franjas carbón anchas y finas, transversales al lado largo. */
function stripes(width, height, k) {
  const bars = [];
  for (let x = 120 * k; x < width - 60 * k; x += 320 * k) {
    bars.push(`<rect x="${x}" y="0" width="${70 * k}" height="${height}" fill="#3a3a38"/>`, `<rect x="${x + 110 * k}" y="0" width="${16 * k}" height="${height}" fill="#3a3a38"/>`);
  }
  return svg(width, height, `<rect width="100%" height="100%" fill="#e7e0d1"/>${bars.join('')}`);
}

/** Espiral trenzada de las alfombras redondas de yute: anillos concéntricos oscuros cada 3 cm. */
function braidRings(width, height, k) {
  const rings = [];
  for (let r = 15 * k; r < width / 2; r += 30 * k) rings.push(`<circle cx="${width / 2}" cy="${height / 2}" r="${r}" fill="none" stroke="#4a3826" stroke-width="${4 * k}" stroke-opacity=".45"/>`);
  return svg(width, height, rings.join(''));
}

/** Repite una imagen a la escala real (`tile` px por repetición) sobre un lienzo del tamaño de la alfombra. */
async function tiled(image, width, height, tile) {
  // Si una repetición es mayor que la alfombra, se recorta: en ese eje no hay junta que casar.
  const piece = await sharp(await image.resize(tile, tile, { fit: 'fill' }).png().toBuffer())
    .extract({ left: 0, top: 0, width: Math.min(tile, width), height: Math.min(tile, height) }).png().toBuffer();
  return sharp({ create: { width, height, channels: 3, background: '#808080' } })
    .composite([{ input: piece, tile: true, gravity: 'northwest' }]).png().toBuffer();
}

/** Relieve en gris centrado en 128 (fusión «luz suave»): conserva la trama de la tela sin cambiar el color del dibujo. */
async function detailLayer(color, width, height, tile, contrast) {
  const grey = sharp(color).greyscale();
  const { channels: [{ mean, stdev }] } = await grey.clone().stats();
  const scale = contrast / Math.max(4, stdev);
  return tiled(grey.linear(scale, 128 - mean * scale), width, height, tile);
}

async function bake(design, widthMm, depthMm, round, overlay) {
  const k = TEXTURE_PX / Math.max(widthMm, depthMm), width = Math.round(widthMm * k), height = Math.round(depthMm * k);
  const tile = Math.max(24, Math.round(design.tileMm * k));
  const source = await cc0Material(...design.texture);
  const layers = [];
  let color;
  if (design.pattern) {
    color = await sharp(design.pattern(width, height, k)).png().toBuffer();
    layers.push({ input: await detailLayer(source.maps.color, width, height, tile, design.detail), blend: 'soft-light' });
  } else {
    color = await tiled(design.grade ? sharp(source.maps.color).modulate(design.grade) : sharp(source.maps.color), width, height, tile);
  }
  if (overlay) layers.push({ input: overlay(width, height, k), blend: 'multiply' });
  if (design.border) {
    const { mm, color: stroke, opacity } = design.border, band = mm * k;
    const shape = round ? `<circle cx="${width / 2}" cy="${height / 2}" r="${width / 2 - band / 2}"` : `<rect x="${band / 2}" y="${band / 2}" width="${width - band}" height="${height - band}"`;
    layers.push({ input: svg(width, height, `${shape} fill="none" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="${band}"/>`), blend: 'multiply' });
  }
  if (layers.length) color = await sharp(color).composite(layers).png().toBuffer();
  const roughnessChannel = source.maps.roughnessChannel === 'green' ? 'green' : 0;
  return {
    source,
    color: await sharp(color).jpeg({ quality: 92 }).toBuffer(),
    normal: await sharp(await tiled(sharp(source.maps.normal), width, height, tile)).jpeg({ quality: 92 }).toBuffer(),
    // Rugosidad en el canal verde (glTF); se sube a 0,5–1: la tela no brilla. Metal 0 por factor.
    roughness: await sharp(await tiled(sharp(source.maps.roughness).extractChannel(roughnessChannel).linear(.5, 128), width, height, tile))
      .toColourspace('srgb').jpeg({ quality: 90 }).toBuffer(),
  };
}

/** Losa sin cara inferior: cara superior con la textura y cantos con el color del borde. Metros, Y hacia arriba. */
function slabGeometry(widthMm, depthMm, round) {
  const w = widthMm / 1000, d = depthMm / 1000, h = HEIGHT_MM / 1000, position = [], normal = [], uv = [], index = [];
  const vertex = (x, y, z, nx, ny, nz) => {
    position.push(x, y, z); normal.push(nx, ny, nz); uv.push(x / w + .5, z / d + .5);
    return position.length / 3 - 1;
  };
  const outline = round
    ? Array.from({ length: ROUND_SEGMENTS }, (_, i) => { const a = i / ROUND_SEGMENTS * Math.PI * 2; return [Math.cos(a) * w / 2, Math.sin(a) * d / 2]; })
    : [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  // Cara superior en abanico desde el centro; el orden (de -Z hacia +Z girando) deja la normal hacia +Y.
  const center = vertex(0, h, 0, 0, 1, 0), ring = outline.map(([x, z]) => vertex(x, h, z, 0, 1, 0));
  ring.forEach((current, i) => index.push(center, ring[(i + 1) % ring.length], current));
  outline.forEach(([x1, z1], i) => {
    const [x2, z2] = outline[(i + 1) % outline.length], length = Math.hypot(x2 - x1, z2 - z1);
    const nx = (z2 - z1) / length, nz = -(x2 - x1) / length;
    const a = vertex(x1, h, z1, nx, 0, nz), b = vertex(x2, h, z2, nx, 0, nz), c = vertex(x2, 0, z2, nx, 0, nz), e = vertex(x1, 0, z1, nx, 0, nz);
    index.push(a, b, c, a, c, e);
  });
  return { position: new Float32Array(position), normal: new Float32Array(normal), uv: new Float32Array(uv), index: new Uint16Array(index) };
}

async function buildGlb(io, name, textures, geometry) {
  const document = new Document(), buffer = document.createBuffer();
  const accessor = (type, array) => document.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const texture = (label, image) => document.createTexture(label).setImage(image).setMimeType('image/jpeg');
  const material = document.createMaterial(name).setMetallicFactor(0).setRoughnessFactor(1)
    .setBaseColorTexture(texture('color', textures.color)).setNormalTexture(texture('normal', textures.normal))
    .setMetallicRoughnessTexture(texture('roughness', textures.roughness));
  const primitive = document.createPrimitive().setMaterial(material).setIndices(accessor('SCALAR', geometry.index))
    .setAttribute('POSITION', accessor('VEC3', geometry.position)).setAttribute('NORMAL', accessor('VEC3', geometry.normal))
    .setAttribute('TEXCOORD_0', accessor('VEC2', geometry.uv));
  const scene = document.createScene(name).addChild(document.createNode(name).setMesh(document.createMesh(name).addPrimitive(primitive)));
  document.getRoot().setDefaultScene(scene);
  await document.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82 }));
  return Buffer.from(await io.writeBinary(document));
}

function catalogue() {
  const designs = new Map(DESIGNS.map((design) => [design.key, design]));
  return [
    ...DESIGNS.flatMap((design) => RECT_SIZES_CM.map(([depth, width]) => ({
      kind: `alfombra_${design.key}_${depth}x${width}`, design, widthMm: width * 10, depthMm: depth * 10, round: false,
    }))),
    ...ROUND.map(({ key, design, diameterMm, overlay }) => ({
      kind: `alfombra_${key}_${diameterMm / 10}`, design: designs.get(design), widthMm: diameterMm, depthMm: diameterMm, round: true, overlay,
    })),
  ];
}

async function main() {
  const args = process.argv.slice(2), force = args.includes('--force'), dryRun = args.includes('--dry-run');
  const wanted = args.filter((arg) => !arg.startsWith('--'));
  const rugs = catalogue().filter((rug) => !wanted.length || wanted.includes(rug.kind));
  if (wanted.length && rugs.length !== wanted.length) throw new Error(`Claves desconocidas: ${wanted.filter((kind) => !rugs.some((rug) => rug.kind === kind)).join(', ')}`);
  const io = new NodeIO().setLogger(new Logger(Logger.Verbosity.WARN)).registerExtensions(ALL_EXTENSIONS);
  const manifest = await readModelManifest();
  let total = 0;
  const failures = [];
  for (const rug of rugs) {
    const file = `${rug.kind}.glb`, destination = path.join(MODELS_DIR, file);
    const registered = manifest.assets.some((item) => item.kind === rug.kind && item.file === file);
    if (existsSync(destination) && registered && !force) { console.log(`⏭  ${file} ya existe (usa --force para regenerarlo)`); continue; }
    try {
      const textures = await bake(rug.design, rug.widthMm, rug.depthMm, rug.round, rug.overlay);
      const glb = await buildGlb(io, rug.kind, textures, slabGeometry(rug.widthMm, rug.depthMm, rug.round));
      const [provider, id] = rug.design.texture, { source } = textures;
      const asset = {
        file, kind: rug.kind, source: `${source.pageUrl.replace('https://', '')} (${source.title}; textura CC0 horneada en una alfombra con scripts/build-cc0-rugs.mjs)`,
        author: source.authors.join(', '), license: 'CC0-1.0', attributionRequired: false, sha256: sha256(glb),
        cc0Texture: `${provider}:${id}`, sourceUrl: source.pageUrl, importedAt: new Date().toISOString().slice(0, 10),
        dimensionsMm: [rug.widthMm, rug.depthMm, HEIGHT_MM],
      };
      if (!dryRun) { await writeFile(destination, glb); upsertModelAsset(manifest, asset); }
      total += glb.length;
      console.log(`✓ ${rug.kind.padEnd(34)} ${asset.dimensionsMm.join('×')} mm  ${(glb.length / 1024).toFixed(0)} KB`);
    } catch (error) {
      failures.push(rug.kind);
      console.error(`✗ ${rug.kind}: ${error instanceof Error ? error.message : error}`);
    }
  }
  if (!dryRun && !wanted.length) {
    // Retira del manifiesto y del disco las alfombras generadas que ya no están en la lista de diseños.
    const current = new Set(rugs.map((rug) => rug.kind));
    for (const stale of manifest.assets.filter((item) => item.cc0Texture && !current.has(item.kind))) {
      await rm(path.join(MODELS_DIR, stale.file), { force: true });
      console.log(`🗑  ${stale.file} retirada`);
    }
    manifest.assets = manifest.assets.filter((item) => !item.cc0Texture || current.has(item.kind));
  }
  if (!dryRun) await writeModelManifest(manifest);
  console.log(`\n${(total / 1048576).toFixed(1)} MB generados.`);
  if (failures.length) { console.error(`Fallaron ${failures.length}: ${failures.join(', ')}`); process.exitCode = 1; }
}

main().catch((error) => { console.error(error); process.exit(1); });
