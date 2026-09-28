import {
  CanvasTexture, Mesh, NoColorSpace, Vector4,
  type Material, type Object3D, type Scene, type WebGLProgramParametersWithUniforms,
} from 'three';
import type { ZoneMaskRegions } from '@/lib/editor-document/render-view';
import { drawZoneMap, zoneMapLayout } from './zone-mask';
import { belongsToFurnitureGroup, furnitureBelongsToZone } from './zone-scene-objects';

const PROJECT_VERTEX = '#include <project_vertex>';
const MAIN = /void\s+main\s*\(\s*\)\s*\{/;

/** Recorta cada fragmento por su posición real en planta, incluso en losas que cruzan la zona. */
export function clipShaderToZone(shader: WebGLProgramParametersWithUniforms,
  texture: CanvasTexture, bounds: Vector4): void {
  if (!shader.vertexShader.includes(PROJECT_VERTEX) || !MAIN.test(shader.fragmentShader)) {
    throw new Error('No se puede aislar un material de la escena para diseñar esta zona.');
  }
  shader.uniforms.habitekaZoneMap = { value: texture };
  shader.uniforms.habitekaZoneBounds = { value: bounds };
  shader.vertexShader = `varying vec3 vHabitekaZoneWorld;\n${shader.vertexShader.replace(PROJECT_VERTEX, `
    vec4 habitekaZoneLocal = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      habitekaZoneLocal = instanceMatrix * habitekaZoneLocal;
    #endif
    vHabitekaZoneWorld = (modelMatrix * habitekaZoneLocal).xyz;
    ${PROJECT_VERTEX}`)}`;
  shader.fragmentShader = `
    uniform sampler2D habitekaZoneMap;
    uniform vec4 habitekaZoneBounds;
    varying vec3 vHabitekaZoneWorld;
    ${shader.fragmentShader.replace(MAIN, (opening) => `${opening}
      vec2 habitekaZoneUv = (vHabitekaZoneWorld.xz - habitekaZoneBounds.xy) / habitekaZoneBounds.zw;
      if (any(lessThan(habitekaZoneUv, vec2(0.0))) ||
          any(greaterThan(habitekaZoneUv, vec2(1.0))) ||
          texture2D(habitekaZoneMap, habitekaZoneUv).r < 0.5) discard;`)}
  `;
}

/**
 * Sustituye temporalmente los materiales, sin modificar el documento ni el 3D de trabajo.
 * Un recorte por objeto dejaría entrar fragmentos de suelo, cubierta y pérgolas grandes.
 */
export function isolateSceneToZone(scene: Scene, regions: ZoneMaskRegions): () => void {
  const layout = zoneMapLayout(regions);
  if (!layout) return () => undefined;
  const texture = new CanvasTexture(drawZoneMap(regions, layout));
  texture.flipY = false;
  texture.colorSpace = NoColorSpace;
  const bounds = new Vector4(layout.minX / 1000, layout.minY / 1000,
    layout.width / 1000, layout.height / 1000);
  const copies = new Map<Material, Material>();
  const changed: { mesh: Mesh; material: Material | Material[] }[] = [];
  const furniture: { group: Object3D; visible: boolean }[] = [];
  const clipped = (original: Material): Material => {
    const existing = copies.get(original);
    if (existing) return existing;
    const copy = original.clone();
    const beforeCompile = original.onBeforeCompile;
    copy.onBeforeCompile = (shader, renderer) => {
      beforeCompile.call(copy, shader, renderer);
      clipShaderToZone(shader, texture, bounds);
    };
    copy.customProgramCacheKey = () => `${original.customProgramCacheKey()}|habiteka-zone-v1`;
    copies.set(original, copy);
    return copy;
  };
  const restore = () => {
    changed.forEach(({ mesh, material }) => { mesh.material = material; });
    furniture.forEach(({ group, visible }) => { group.visible = visible; });
    copies.forEach((copy) => copy.dispose());
    texture.dispose();
  };
  try {
    scene.updateMatrixWorld(true);
    scene.traverse((object) => {
      if (object.userData.videoStage === 3) {
        furniture.push({ group: object, visible: object.visible });
        object.visible = object.visible && furnitureBelongsToZone(object, regions);
      }
      if (!(object instanceof Mesh)) return;
      if (belongsToFurnitureGroup(object)) return;
      const material = object.material;
      changed.push({ mesh: object, material });
      object.material = Array.isArray(material) ? material.map(clipped) : clipped(material);
    });
  } catch (error) {
    restore();
    throw error;
  }
  return restore;
}
