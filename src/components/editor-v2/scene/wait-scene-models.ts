import { Mesh, type Object3D } from 'three';
export async function waitSceneModels(scene: Object3D, signal: AbortSignal, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    signal.throwIfAborted();
    let loading = false, failed = false;
    scene.traverse(object => {
      if (object.userData.roofError) throw new Error(String(object.userData.roofError));
      loading ||= object.userData.modelLoadState === 'loading';
      failed ||= object.userData.modelLoadState === 'failed';
      if (object instanceof Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        loading ||= material.userData.textureLoadState === 'loading';
        failed ||= material.userData.textureLoadState === 'failed';
      }
    });
    if (failed) throw new Error('Hay modelos 3D o texturas no disponibles. La exportación exige conservar todos los elementos; vuelve a cargar la escena.');
    if (!loading) return;
    if (Date.now() >= deadline) throw new Error('Los modelos 3D o las texturas siguen cargando. Espera y vuelve a exportar.');
    await new Promise<void>(resolve => setTimeout(resolve, 100));
  }
}
