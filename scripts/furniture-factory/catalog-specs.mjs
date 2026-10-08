/**
 * Fuente única de verdad de la fábrica de muebles: descubre las familias de families/*.mjs, expande cada producto en
 * piezas (una por variante) y las valida. De esta lista salen los GLB (Blender), el registro del catálogo y la
 * procedencia.
 *
 * Una familia es un archivo families/<id>.mjs que exporta:
 *   FAMILY   { id: '<id>' (igual que el nombre del archivo), label, room (estancia por defecto), dependsOn?: [nombres] }
 *            dependsOn lista otras familias o módulos auxiliares cuyo scripts/blender/fam_<nombre>.py importa la
 *            familia: entran en la huella del generador para que un cambio en ellos regenere sus piezas.
 *   PRODUCTS [{ product, type, label, profile, style, room?, params?, finishes, mainSlot?, textureSize?, hidden?,
 *              counterMm?, variants }]
 *            hidden: true deja las piezas fuera del catálogo (estados de cortinas y persianas que la app elige por
 *            medida y cobertura). counterMm (también por variante): cota de la encimera o del borde de un lavabo o
 *            fregadero, que es lo que dibuja la sección; el grifo queda por encima.
 *   FINISHES y TEXTURES (opcionales): acabados y texturas CC0 propios, que se suman a los comunes de finishes.mjs.
 * y se construye con scripts/blender/fam_<id>.py (BUILDERS: type → función). No hay listas de familias a mano.
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FINISHES, TEXTURES } from './finishes.mjs';

export const GENERATOR_VERSION = '1.1.0';
const FAMILIES_DIR = fileURLToPath(new URL('./families/', import.meta.url));

/** Estancias de FurnitureRoom (src/lib/editor-document/furniture-catalog.ts). */
const ROOMS = new Set(['salon', 'dormitorio', 'infantil', 'comedor', 'cocina', 'bano', 'lavadero', 'recibidor', 'oficina', 'garaje',
  'exterior', 'iluminacion', 'decoracion']);
/** Perfiles de FurnitureProfile (src/lib/editor-document/furniture-catalog.ts) que puede usar un mueble fabricado. */
const PROFILES = new Set(['sofa', 'sofa-chaise', 'sofa-corner', 'sofa-modular', 'sofa-bed', 'bed', 'chair', 'table', 'cabinet',
  'shelf', 'kitchen', 'sink', 'toilet', 'bath', 'shower', 'lamp', 'plant', 'decor', 'appliance', 'screen', 'bench', 'rug',
  'curtain', 'curtain-open', 'roller', 'venetian', 'vertical-blind', 'shutter']);
const MAIN_SLOTS = ['tapiceria', 'madera', 'sobre', 'estructura', 'carcasa', 'metal', 'trenzado', 'cuerda'];

function fail(message) {
  throw new Error(`Especificación no válida: ${message}`);
}

/**
 * Importa todas las familias de families/*.mjs en orden alfabético. Con `fresh`, vuelve a leerlas del disco (Node guarda
 * en caché los módulos ya importados): el registro se compone al final con las especificaciones de ese momento.
 */
export async function loadFamilies({ fresh = false } = {}) {
  const files = (await readdir(FAMILIES_DIR)).filter((file) => file.endsWith('.mjs')).sort();
  const families = [];
  for (const file of files) {
    const id = file.slice(0, -4);
    if (!/^[a-z0-9_]+$/.test(id)) fail(`nombre de familia «${id}» (solo minúsculas, números y _)`);
    const url = pathToFileURL(path.join(FAMILIES_DIR, file)).href;
    const spec = await import(fresh ? `${url}?v=${Date.now()}` : url);
    if (spec.FAMILY?.id !== id) fail(`families/${file}: FAMILY.id debe ser «${id}»`);
    if (!Array.isArray(spec.PRODUCTS)) fail(`families/${file}: falta PRODUCTS`);
    families.push({ ...spec.FAMILY, products: spec.PRODUCTS, finishes: spec.FINISHES ?? {}, textures: spec.TEXTURES ?? {} });
  }
  return families;
}

/** Acabados y texturas comunes más los propios de cada familia; una clave repetida es un error. */
export function buildLibrary(families) {
  const library = { finishes: { ...FINISHES }, textures: { ...TEXTURES } };
  for (const family of families) {
    for (const kind of ['finishes', 'textures']) {
      for (const [key, value] of Object.entries(family[kind])) {
        if (library[kind][key]) fail(`${family.id}: ${kind === 'finishes' ? 'acabado' : 'textura'} «${key}» ya existe`);
        library[kind][key] = value;
      }
    }
  }
  return library;
}

/** Expande y valida todas las piezas. Lanza un error con la primera incoherencia encontrada. */
export function expandSpecs(families, library) {
  const pieces = [];
  for (const family of families) {
    for (const product of family.products) {
      const where = `${family.id}/${product.product}`;
      if (!/^[a-z0-9_]+$/.test(product.product ?? '')) fail(`${where}: clave de producto`);
      if (!product.variants?.length) fail(`${where}: sin variantes`);
      const proposals = product.variants.filter((variant) => variant.proposal).length;
      if (proposals !== 1) fail(`${where}: debe marcar exactamente una variante con proposal (tiene ${proposals})`);
      for (const variant of product.variants) {
        const id = `${product.product}_${variant.key}`;
        // Un acabado a undefined en la variante retira ese hueco del producto (p. ej., tumbona de aluminio sin madera).
        const finishes = Object.fromEntries(Object.entries({ ...product.finishes, ...variant.finishes }).filter(([, name]) => name));
        const mainSlot = [product.mainSlot, ...MAIN_SLOTS].find((slot) => slot && finishes[slot]);
        const main = library.finishes[finishes[mainSlot]];
        if (!main) fail(`${id}: sin acabado principal`);
        const piece = {
          id, productId: `habiteka-${product.product}`, family: family.id, type: variant.type ?? product.type,
          label: product.label, variantLabel: [variant.size, main.name].filter(Boolean).join(' · '),
          room: variant.room ?? product.room ?? family.room, profile: variant.profile ?? product.profile, style: product.style,
          material: main.material, color: main.swatch, dims: variant.dims,
          params: { ...product.params, ...variant.params }, finishes, textureSize: product.textureSize ?? 1024,
          proposal: Boolean(variant.proposal),
          // Solo se añaden si están definidos: así no cambian la huella de las piezas que no los usan.
          ...(product.hidden ? { hidden: true } : {}),
          ...((variant.counterMm ?? product.counterMm) !== undefined ? { counterMm: variant.counterMm ?? product.counterMm } : {}),
        };
        validatePiece(piece, library);
        pieces.push(piece);
      }
    }
  }
  const ids = new Set();
  for (const piece of pieces) {
    if (ids.has(piece.id)) fail(`id repetido ${piece.id}`);
    ids.add(piece.id);
  }
  return pieces;
}

function validatePiece(piece, library) {
  if (!/^[a-z0-9_]+$/.test(piece.id)) fail(`id «${piece.id}»`);
  if (!ROOMS.has(piece.room)) fail(`${piece.id}: estancia «${piece.room}»`);
  if (!PROFILES.has(piece.profile)) fail(`${piece.id}: perfil «${piece.profile}»`);
  if (!piece.type) fail(`${piece.id}: sin tipo`);
  if (!piece.label?.trim() || !piece.variantLabel?.trim() || !piece.style?.trim()) fail(`${piece.id}: nombre, variante o estilo vacíos`);
  const maximum = piece.room === 'exterior' ? 20000 : 4000;
  if (!Array.isArray(piece.dims) || piece.dims.length !== 3 || !piece.dims.every((value) => Number.isInteger(value) && value > 0 && value <= maximum)) {
    fail(`${piece.id}: medidas ${JSON.stringify(piece.dims)} (enteros en mm, 1–${maximum})`);
  }
  if (![512, 1024].includes(piece.textureSize)) fail(`${piece.id}: textureSize ${piece.textureSize}`);
  if (piece.counterMm !== undefined && !(Number.isInteger(piece.counterMm) && piece.counterMm > 0 && piece.counterMm <= piece.dims[2] + 1500)) {
    fail(`${piece.id}: counterMm ${piece.counterMm} (entero en mm)`);
  }
  for (const [slot, name] of Object.entries(piece.finishes)) {
    const finish = library.finishes[name];
    if (!finish) fail(`${piece.id}: acabado «${name}» en ${slot}`);
    const texture = finish.texture && library.textures[finish.texture];
    if (finish.texture && !texture) fail(`${piece.id}: textura «${finish.texture}»`);
    if (texture && !['polyhaven', 'ambientcg'].includes(texture.source)) fail(`${piece.id}: la textura «${finish.texture}» no es de una fuente CC0 admitida`);
    if (!finish.texture && !['metal', 'paint', 'glass'].includes(finish.kind)) fail(`${piece.id}: acabado liso «${name}» sin tipo`);
  }
}

/** Selecciona piezas por familia, producto o id (`--only=sofas,cama_tapizada,cama_tapizada_150`). */
export function selectPieces(pieces, only) {
  if (!only?.length) return pieces;
  const matches = (piece, key) => piece.family === key || piece.id === key || piece.productId === `habiteka-${key}`;
  const unknown = only.filter((key) => !pieces.some((piece) => matches(piece, key)));
  if (unknown.length) throw new Error(`No existen: ${unknown.join(', ')}`);
  return pieces.filter((piece) => only.some((key) => matches(piece, key)));
}
