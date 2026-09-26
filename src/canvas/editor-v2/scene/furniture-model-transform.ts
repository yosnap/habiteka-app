import { Box3, Color, Group, Texture, Vector3, type Material, type Mesh, type Object3D } from 'three';

/** Orient first, then fit the actual bounds. Shared cached geometry is never mutated. */
export function prepareFurnitureModel(source: Object3D, frontRotation: number, tint?: string, anisotropy = 1) {
  const copy = source.clone(true), materials: Material[] = [];
  copy.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true; mesh.receiveShadow = true;
    const cloneMaterial = (original: Material) => {
      const material = original.clone() as Material & { color?: Color };
      // El color pintado sustituye al color base del material (multiplicarlo nunca podía aclarar una madera
      // marrón); la textura, la rugosidad, la opacidad y el vidrio se conservan.
      if (tint && material.color && !(material.transparent && material.opacity < .8)) material.color.set(new Color(tint));
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) {
        const texture = (material as unknown as Record<string, unknown>)[key];
        if (texture instanceof Texture) { texture.anisotropy = anisotropy; texture.needsUpdate = true; }
      }
      materials.push(material); return material;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(cloneMaterial) : cloneMaterial(mesh.material);
  });
  const oriented = new Group(); oriented.rotation.y = frontRotation; oriented.add(copy); oriented.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(oriented), size = bounds.getSize(new Vector3());
  if (![size.x, size.y, size.z].every((value) => Number.isFinite(value) && value > 1e-8)) {
    materials.forEach((material) => material.dispose()); throw new Error('El modelo no tiene dimensiones válidas.');
  }
  const center = bounds.getCenter(new Vector3()), normalized = new Group();
  oriented.position.set(-center.x, -bounds.min.y, -center.z); normalized.add(oriented);
  normalized.scale.set(1 / size.x, 1 / size.y, 1 / size.z);
  return { object: normalized, dispose: () => materials.forEach((material) => material.dispose()) };
}
