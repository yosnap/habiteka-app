/** Lectura y escritura de public/models/cc0/manifest.json, compartida por los importadores de modelos CC0. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const MODELS_DIR = fileURLToPath(new URL('../../public/models/cc0/', import.meta.url));
const MANIFEST = fileURLToPath(new URL('../../public/models/cc0/manifest.json', import.meta.url));

export const readModelManifest = async () => JSON.parse(await readFile(MANIFEST, 'utf8'));

/** Mantiene el formato compacto del manifiesto: una línea por modelo. */
export async function writeModelManifest(manifest) {
  const line = (asset) => `{ ${Object.entries(asset).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(', ')} }`;
  await writeFile(MANIFEST, `{\n  "_comment": ${JSON.stringify(manifest._comment)},\n  "assets": [\n${manifest.assets.map((asset) => `    ${line(asset)}`).join(',\n')}\n  ]\n}\n`);
}

/** Inserta o sustituye por clave; un mismo archivo no puede servir a dos claves ni una clave a dos archivos. */
export function upsertModelAsset(manifest, asset) {
  const clash = manifest.assets.find((item) => item.file === asset.file && item.kind !== asset.kind)
    ?? manifest.assets.find((item) => item.kind === asset.kind && item.file !== asset.file);
  if (clash) throw new Error(`${asset.file}/${asset.kind} choca con ${clash.file}/${clash.kind} en el manifiesto`);
  const index = manifest.assets.findIndex((item) => item.kind === asset.kind);
  if (index >= 0) manifest.assets[index] = asset; else manifest.assets.push(asset);
}
