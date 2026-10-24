/** Importación reproducible de vehículos reales CC BY 4.0, fuera de la fábrica de geometría propia. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { createGltfIO, compressDocument, measureDocument, triangleCount } from './lib/glb-optimize.mjs';

const models = [
  { id: 'coche_tesla_model_3_2018', label: 'Tesla Model 3 · 2018', author: 'Ameer Studio',
    uid: '5ef9b845aaf44203b6d04e2c677e444f', sourceFile: 'tesla-model-3-2018.glb', lengthMm: 4694, rotation: 1 },
  { id: 'coche_ford_mustang_gt_2005', label: 'Ford Mustang GT · 2005', author: 'Ricy',
    uid: '26b6b60cf2804370ac3c64424242dc1f', sourceFile: 'mustang-2005.glb', lengthMm: 4775, rotation: 0 },
];
const output = 'public/models/vehicles';
const temporary = path.join(os.tmpdir(), 'habiteka-import-real-vehicles');
await mkdir(output, { recursive: true });
await mkdir(temporary, { recursive: true });
const io = await createGltfIO();
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = [];
for (const model of models) {
  const response = await fetch(`https://api.sketchfab.com/v3/models/${model.uid}`);
  if (!response.ok) throw new Error(`No se pudo verificar la licencia de ${model.label}`);
  const metadata = await response.json();
  if (metadata.license?.slug !== 'by' || metadata.user?.displayName !== model.author) {
    throw new Error(`Autor o licencia inesperados: ${model.label}`);
  }
  const downloadUrl = `https://raw.githubusercontent.com/nesdesignco/FormDrive/main/public/models/${model.sourceFile}`;
  const download = await fetch(downloadUrl);
  if (!download.ok) throw new Error(`No se pudo obtener ${model.label}`);
  const original = Buffer.from(await download.arrayBuffer());
  const input = path.join(temporary, `${model.id}-source.glb`);
  const normalized = path.join(temporary, `${model.id}-normalized.glb`);
  const photo = path.join(temporary, `${model.id}.png`);
  await writeFile(input, original);
  execFileSync(process.env.BLENDER_BIN ?? '/Applications/Blender.app/Contents/MacOS/Blender',
    ['-b', '--python', 'scripts/blender/prepare-real-vehicle.py', '--', input, normalized, photo,
      String(model.lengthMm), String(model.rotation)], { stdio: 'inherit' });
  const document = await io.read(normalized);
  // Vehículos cerrados: las caras de techo/interior orientadas hacia dentro no deben dibujarse desde fuera.
  // Mantiene las normales y los materiales; evita que las dos caras se mezclen en la vista cenital.
  for (const material of document.getRoot().listMaterials()) material.setDoubleSided(false);
  const originalTriangles = triangleCount(document);
  await compressDocument(document, { maxTexturePx: 1024, simplifyRatio: Math.min(1, 90000 / originalTriangles), quantizePosition: 16 });
  document.getRoot().setExtras({ attribution: `${model.label} — ${model.author}`, license: 'CC BY 4.0',
    source: `https://sketchfab.com/3d-models/${model.uid}`, licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    modifications: 'Escala, orientación, simplificación y compresión para Habiteka.' });
  const binary = await io.writeBinary(document);
  const file = `${model.id}.glb`, thumbnail = `${model.id}.webp`;
  await writeFile(path.join(output, file), binary);
  // La miniatura debe enseñar la geometría optimizada que realmente carga el editor.
  execFileSync(process.env.BLENDER_BIN ?? '/Applications/Blender.app/Contents/MacOS/Blender',
    ['-b', '--python', 'scripts/blender/prepare-real-vehicle.py', '--', path.resolve(output, file), normalized,
      photo, String(model.lengthMm), '0'], { stdio: 'inherit' });
  await sharp(await readFile(photo)).flatten({ background: '#f5f5f2' }).resize(640, 480).webp({ quality: 85 })
    .toFile(path.join(output, thumbnail));
  manifest.push({ ...model, file, thumbnail, sha256: sha(binary), sourceSha256: sha(original), downloadUrl,
    source: `https://sketchfab.com/3d-models/${model.uid}`, license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', dimensionsMm: measureDocument(document),
    bytes: binary.length, triangles: triangleCount(document), attributionRequired: true,
    paintMaterialNames: document.getRoot().listMaterials().map(m => m.getName()).filter(name => name.startsWith('pintura')),
    modifications: 'Escala uniforme, orientación y pivote; caras interiores visibles solo desde dentro, reducción de geometría, texturas WebP de hasta 1024 px y compresión meshopt.',
    verifiedAt: new Date().toISOString().slice(0, 10) });
  console.log('INTEGRADO', model.label, binary.length, triangleCount(document));
}
await writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
