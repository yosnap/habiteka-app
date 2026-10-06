/** Proxies conservadores de mesas y asientos, derivados de sus GLB y la misma orientación del editor. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Box3, Matrix4, Triangle, Vector3 } from 'three';
import { Logger } from '@gltf-transform/core';
import { createGltfIO } from './lib/glb-optimize.mjs';
import { collisionVoxels } from './lib/model-collision-voxels';
import { FURNITURE_CATALOG } from '../src/lib/editor-document/furniture-catalog';
import { furnitureModel } from '../src/lib/editor-document/furniture-models';

const output = 'src/lib/editor-document/generated/furniture-collision-proxies.json';
const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice(7).split(',');
type RecordEntry = ReturnType<typeof collisionVoxels> & { sha256: string; frontRotation: number };
const registry: Record<string, RecordEntry> = only ? JSON.parse(await readFile(output, 'utf8').catch(() => '{}')) : {};
const assets = new Map(FURNITURE_CATALOG.filter((entry) => ['table', 'chair', 'bench'].includes(entry.profile))
  .map((entry) => furnitureModel({ catalogId: entry.id })).filter((asset) => asset !== undefined).map((asset) => [asset.key, asset]));
const io = await createGltfIO(Logger.Verbosity.ERROR);
for (const asset of assets.values()) {
  if (only && !only.includes(asset.key)) continue;
  const data = await readFile(`public${asset.url.split('?')[0]}`), sha256 = createHash('sha256').update(data).digest('hex');
  const document = await io.readBinary(data), triangles: Triangle[] = [];
  const rotation = new Matrix4().makeRotationY(asset.frontRotation);
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0]!;
  scene.traverse((node) => {
    const mesh = node.getMesh(); if (!mesh) return;
    const matrix = rotation.clone().multiply(new Matrix4().fromArray(node.getWorldMatrix()));
    for (const primitive of mesh.listPrimitives()) {
      const positions = primitive.getAttribute('POSITION'); if (!positions) continue;
      const indices = primitive.getIndices(), count = indices?.getCount() ?? positions.getCount();
      const point = (index: number) => new Vector3().fromArray(positions.getElement(indices ? indices.getScalar(index) : index, [])).applyMatrix4(matrix);
      for (let i = 0; i + 2 < count; i += 3) triangles.push(new Triangle(point(i), point(i + 1), point(i + 2)));
    }
  });
  const bounds = new Box3(); triangles.forEach((triangle) => [triangle.a, triangle.b, triangle.c].forEach((point) => bounds.expandByPoint(point)));
  registry[asset.key] = { ...collisionVoxels(triangles, bounds), sha256, frontRotation: asset.frontRotation };
  console.log(`${asset.key}: ${registry[asset.key]!.boxes.length} sólidos`);
}
await mkdir('src/lib/editor-document/generated', { recursive: true });
await writeFile(output, `{
${Object.keys(registry).sort().map((key) => `  ${JSON.stringify(key)}: ${JSON.stringify(registry[key])}`).join(',\n')}
}
`);
