import { Mesh, Light, type Material, type Object3D } from 'three';

export function constructionProgress(stage: number, progress: number, _key: string, index = 0, count = 1): number {
  // Cada muro termina antes de que comience el siguiente. Sus fragmentos comparten índice.
  return Math.max(0, Math.min(1, stage === 1 ? progress * count - index : progress));
}

/** Escena temporal de grabación. Conserva y restaura transformaciones y materiales. */
export function prepareConstructionAnimation(scene: Object3D) {
  const stages: { object: Object3D; stage: number; visible: boolean; positionY: number; scaleY: number;
    materials: { original: Material; clone: Material }[]; lights: { light: Light; intensity: number }[] }[] = [];
  const meshes: { mesh: Mesh; material: Material | Material[]; clones: Material[] }[] = [];
  scene.traverse(object => {
    const stage = object.userData.videoStage;
    if (typeof stage !== 'number') return;
    const materials: { original: Material; clone: Material }[] = [], lights: { light: Light; intensity: number }[] = [];
    if (stage >= 0 && stage !== 1) object.traverse(child => {
      if (child instanceof Mesh) {
        const original = child.material as Material | Material[];
        const copies = (Array.isArray(original) ? original : [original]).map(material => {
          const clone = material.clone();
          clone.onBeforeCompile = material.onBeforeCompile;
          clone.customProgramCacheKey = material.customProgramCacheKey;
          materials.push({ original: material, clone }); return clone;
        });
        meshes.push({ mesh: child, material: original, clones: copies });
        child.material = Array.isArray(original) ? copies : copies[0]!;
      }
      if (child instanceof Light) lights.push({ light: child, intensity: child.intensity });
    });
    stages.push({ object, stage, visible: object.visible, positionY: object.position.y, scaleY: object.scale.y, materials, lights });
  });
  // Orden estable del plano; nunca depende de un UUID aleatorio de Three.js.
  const keys = [...new Set(stages.filter(item => item.stage === 1 && item.visible)
    .map(item => item.object.userData.buildKey ?? item.object.uuid))];
  const order = new Map(keys.map((key, index) => [key, index]));
  return {
    wallCount: keys.length,
    apply(stage: number, progress: number, promotion: boolean) {
      for (const item of stages) {
        const { object } = item;
        const fraction = item.stage < stage ? 1 : item.stage > stage ? 0
          : constructionProgress(stage, progress, object.userData.buildKey ?? object.uuid,
            order.get(object.userData.buildKey ?? object.uuid) ?? 0, keys.length || 1);
        object.visible = object.userData.interventionSurface ? (promotion ? item.stage <= stage : stage >= -1)
          : fraction > 0 && item.visible;
        if (item.stage === 1) {
          object.scale.y = item.scaleY * Math.max(.0001, fraction);
          object.position.y = item.positionY + (object.userData.buildBaseM ?? 0) * item.scaleY * (1 - fraction);
        }
        for (const { original, clone } of item.materials) {
          clone.opacity = original.opacity * fraction;
          clone.transparent = fraction < 1 || original.transparent;
          clone.depthWrite = fraction === 1 && original.depthWrite;
        }
        for (const { light, intensity } of item.lights) light.intensity = intensity * fraction;
      }
    },
    restore() {
      for (const item of stages) {
        item.object.visible = item.visible; item.object.position.y = item.positionY; item.object.scale.y = item.scaleY;
        for (const { light, intensity } of item.lights) light.intensity = intensity;
      }
      for (const { mesh, material, clones } of meshes) { mesh.material = material; clones.forEach(clone => clone.dispose()); }
    },
  };
}
