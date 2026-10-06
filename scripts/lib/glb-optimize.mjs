/**
 * Optimización común de modelos GLB para el editor: geometría deduplicada, soldada y comprimida con meshopt,
 * texturas WebP con tamaño máximo y pivote en el centro de la base. La comparten el importador de Poly Haven y la
 * fábrica de muebles propia.
 */
import { Logger, NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { center, dedup, flatten, join, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

export async function createGltfIO(verbosity = Logger.Verbosity.WARN) {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  return new NodeIO().setLogger(new Logger(verbosity)).registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
}

/** Aplica la cadena de optimización. `simplifyRatio` reduce la malla cuando el modelo excede el presupuesto. */
export async function compressDocument(document, { maxTexturePx = 1024, simplifyRatio } = {}) {
  await document.transform(
    dedup(), flatten(), join(), weld(),
    ...(simplifyRatio ? [simplify({ simplifier: MeshoptSimplifier, ratio: simplifyRatio, error: 0.001 })] : []),
    prune(), center({ pivot: 'below' }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [maxTexturePx, maxTexturePx], quality: 85 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  return document;
}

/** Medidas de la escena en mm como [ancho (X), fondo (Z), alto (Y)]. */
export function measureDocument(document) {
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
  const { min, max } = getBounds(scene);
  const [width, height, depth] = max.map((value, axis) => Math.round((value - min[axis]) * 1000));
  return [width, depth, height];
}

/**
 * Cota (mm) del punto más bajo de la escena antes de optimizarla: la elevación de una pieza colgada (mueble de lavabo
 * suspendido, espejo, toallero). compressDocument la apoya después en y = 0, así que hay que medirla antes.
 */
export function measureElevation(document) {
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
  return Math.round(getBounds(scene).min[1] * 1000);
}

export function triangleCount(document) {
  let total = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const count = primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')?.getCount() ?? 0;
      total += Math.floor(count / 3);
    }
  }
  return total;
}
