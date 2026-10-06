/**
 * Descarga de texturas PBR CC0 desde ambientCG y Poly Haven, compartida por los importadores de materiales y alfombras.
 *
 * - Solo se admiten URL https de los dominios de ambos proveedores (ni redirecciones a otros sitios).
 * - Las descargas se guardan en una caché local (fuera del repositorio) para que reimportar no vuelva a bajar nada.
 * - Poly Haven publica el MD5 de cada archivo y se verifica; ambientCG entrega un ZIP 1K-JPG del que se extraen
 *   color, normal (convención OpenGL, la de three.js) y rugosidad.
 *
 * Licencias: todo el contenido de ambientCG (https://docs.ambientcg.com/license/) y de Poly Haven
 * (https://polyhaven.com/license) es CC0 1.0.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

const USER_AGENT = 'habiteka-catalog-import/1.0 (+https://habiteka.app)';
const ALLOWED_HOSTS = /(^|\.)(ambientcg\.com|struffelproductions\.com|polyhaven\.com|polyhaven\.org)$/;
export const CACHE_DIR = path.join(os.tmpdir(), 'habiteka-cc0-cache');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const md5 = (buffer) => createHash('md5').update(buffer).digest('hex');
export const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

function assertAllowed(url) {
  const { protocol, hostname } = new URL(url);
  if (protocol !== 'https:' || !ALLOWED_HOSTS.test(hostname)) throw new Error(`URL no permitida: ${url}`);
}

/** GET con reintentos ante errores de red, 429 o 5xx. Comprueba también el destino final de las redirecciones. */
export async function request(url) {
  assertAllowed(url);
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(120_000) });
      assertAllowed(response.url || url);
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status} en ${url}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error;
    }
    await sleep(1000 * attempt);
  }
  throw lastError;
}

export const fetchJson = async (url) => (await request(url)).json();

/** Descarga a la caché (o la reutiliza) y devuelve el contenido. */
async function cached(url, name, expectedMd5) {
  const file = path.join(CACHE_DIR, name);
  if (existsSync(file)) {
    const buffer = await readFile(file);
    if (!expectedMd5 || md5(buffer) === expectedMd5) return buffer;
  }
  const buffer = Buffer.from(await (await request(url)).arrayBuffer());
  if (expectedMd5 && md5(buffer) !== expectedMd5) throw new Error(`MD5 distinto en ${url}`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buffer);
  return buffer;
}

/** Lector ZIP mínimo (sin ZIP64): devuelve las entradas cuyo nombre cumple `wanted`. */
export function unzip(buffer, wanted) {
  let end = buffer.length - 22;
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error('ZIP sin directorio central');
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const files = new Map();
  for (let index = 0; index < count; index++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('ZIP con directorio central dañado');
    const method = buffer.readUInt16LE(offset + 10), size = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28), extra = buffer.readUInt16LE(offset + 30);
    const comment = buffer.readUInt16LE(offset + 32), local = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    offset += 46 + nameLength + extra + comment;
    if (!wanted(name)) continue;
    if (buffer.readUInt32LE(local) !== 0x04034b50) throw new Error(`Cabecera local dañada: ${name}`);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const data = buffer.subarray(start, start + size);
    if (method === 0) files.set(name, Buffer.from(data));
    else if (method === 8) files.set(name, inflateRawSync(data));
    else throw new Error(`Compresión ZIP no admitida (${method}): ${name}`);
  }
  return files;
}

/**
 * Mapas 1K de un material de ambientCG. `dimensionX/Y` de la API están en centímetros (0 si no se publican).
 * Devuelve buffers JPEG originales y la procedencia. Con `alpha` admite también los atlas de hojas (dataType 'Atlas')
 * y devuelve además su mapa de opacidad (`maps.opacity`).
 */
export async function ambientcgMaterial(assetId, { alpha = false } = {}) {
  if (!/^[A-Za-z0-9]+$/.test(assetId)) throw new Error(`Id de ambientCG no válido: ${assetId}`);
  const data = await fetchJson(`https://ambientcg.com/api/v2/full_json?id=${assetId}&include=downloadData,displayData,dimensionsData`);
  const asset = data?.foundAssets?.find((item) => item.assetId === assetId);
  const types = alpha ? ['Material', 'Atlas'] : ['Material'];
  if (!asset || !types.includes(asset.dataType)) throw new Error(`${assetId} no es un ${alpha ? 'material ni un atlas' : 'material'} de ambientCG`);
  const download = asset.downloadFolders?.default?.downloadFiletypeCategories?.zip?.downloads
    ?.find((item) => item.attribute === '1K-JPG');
  if (!download?.downloadLink) throw new Error(`${assetId} no tiene descarga 1K-JPG`);
  const zip = await cached(download.downloadLink, `ambientcg/${download.fileName}`);
  const wanted = alpha ? /_(Color|NormalGL|Roughness|Opacity)\.jpe?g$/i : /_(Color|NormalGL|Roughness)\.jpe?g$/i;
  const entries = unzip(zip, (name) => wanted.test(name));
  const pick = (suffix) => [...entries].find(([name]) => new RegExp(`_${suffix}\\.jpe?g$`, 'i').test(name))?.[1];
  const maps = { color: pick('Color'), normal: pick('NormalGL'), roughness: pick('Roughness'), ...(alpha ? { opacity: pick('Opacity') } : {}) };
  for (const [key, value] of Object.entries(maps)) if (!value) throw new Error(`${assetId} sin mapa ${key}`);
  const widthMm = (asset.dimensionX ?? 0) * 10, heightMm = (asset.dimensionY ?? 0) * 10;
  return {
    maps, title: asset.displayName, authors: ['ambientCG'], pageUrl: `https://ambientcg.com/view?id=${assetId}`,
    dimensionsMm: widthMm >= 50 ? [widthMm, heightMm > 0 ? heightMm : widthMm] : undefined,
    downloads: [{ url: download.downloadLink, bytes: zip.length, sha256: sha256(zip) }],
  };
}

/**
 * Mapas 1K de una textura de Poly Haven, verificados con el MD5 publicado. Con `alpha` se leen en cambio las texturas
 * de hojas de un modelo (tipo 2, p. ej. un helecho) y se devuelve además su mapa Alpha (`maps.opacity`); las medidas del
 * modelo no son las de la textura y no se publican.
 */
export async function polyhavenMaterial(id, { alpha = false } = {}) {
  if (!/^[a-z0-9_]+$/.test(id)) throw new Error(`Id de Poly Haven no válido: ${id}`);
  const [info, files] = await Promise.all([
    fetchJson(`https://api.polyhaven.com/info/${id}`), fetchJson(`https://api.polyhaven.com/files/${id}`),
  ]);
  if (info?.type !== (alpha ? 2 : 1)) throw new Error(`${id} no es ${alpha ? 'un modelo' : 'una textura'} de Poly Haven`);
  const source = (key) => files?.[key]?.['1k']?.jpg;
  const color = source('Diffuse') ?? source('col_01') ?? source('col_1'), normal = source('nor_gl');
  const roughness = source('Rough') ?? source('arm'), opacity = alpha ? source('Alpha') : undefined;
  if (!color || !normal || !roughness) throw new Error(`${id} no tiene color, normal y rugosidad 1K`);
  if (alpha && !opacity) throw new Error(`${id} no tiene mapa Alpha 1K`);
  const selected = [color, normal, roughness, ...(opacity ? [opacity] : [])];
  const downloads = selected.map(({ url, md5: hash, size }) => ({ url, bytes: size, md5: hash }));
  const [colorBuffer, normalBuffer, roughBuffer, opacityBuffer] = await Promise.all(selected
    .map(({ url, md5: hash }) => cached(url, `polyhaven/${path.basename(new URL(url).pathname)}`, hash)));
  return {
    // El mapa ARM empaqueta oclusión, rugosidad y metal en R, G y B: la rugosidad es el canal verde.
    maps: { color: colorBuffer, normal: normalBuffer, roughness: roughBuffer, roughnessChannel: source('Rough') ? undefined : 'green',
      ...(opacityBuffer ? { opacity: opacityBuffer } : {}) },
    title: info.name, authors: Object.keys(info.authors ?? {}), pageUrl: `https://polyhaven.com/a/${id}`,
    // Algunas fichas publican medidas absurdas (p. ej. 0,00008 mm): por debajo de 5 cm se descartan.
    dimensionsMm: !alpha && info.dimensions?.[0] >= 50 ? info.dimensions.slice(0, 2).map(Math.round) : undefined, downloads,
  };
}

/** `options.alpha`: atlas de hojas con transparencia (ver ambientcgMaterial y polyhavenMaterial). */
export async function cc0Material(source, id, options = {}) {
  if (source === 'ambientcg') return ambientcgMaterial(id, options);
  if (source === 'polyhaven') return polyhavenMaterial(id, options);
  throw new Error(`Fuente CC0 desconocida: ${source}`);
}
