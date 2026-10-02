import {
  CanvasTexture, Mesh, NoColorSpace, Vector4,
  type Material, type Object3D, type Scene, type WebGLProgramParametersWithUniforms,
} from 'three';
import type { ZoneMaskRegions } from '@/lib/editor-document/render-view';
import { drawZoneMap, zoneMapLayout, ZONE_SUPPORT_MARGIN_MM } from './zone-mask';
import { belongsToFurnitureGroup, cutawaySupportHeight, furnitureBelongsToZone } from './zone-scene-objects';
import { belongsToZoneStructure } from './zone-structural-mask';

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
export function isolateSceneToZone(scene: Scene, regions: ZoneMaskRegions,
  video = false, hideTerrain = false, structuralMarginMm?: number): () => void {
  const layout = zoneMapLayout(regions);
  if (!layout) return () => undefined;
  const texture = new CanvasTexture(drawZoneMap(regions, layout));
  texture.flipY = false;
  texture.colorSpace = NoColorSpace;
  const bounds = new Vector4(layout.minX / 1000, layout.minY / 1000,
    layout.width / 1000, layout.height / 1000);
  const supportLayout = zoneMapLayout(regions, ZONE_SUPPORT_MARGIN_MM)!;
  const supportTexture = new CanvasTexture(drawZoneMap(regions, supportLayout, ZONE_SUPPORT_MARGIN_MM));
  supportTexture.flipY = false;
  supportTexture.colorSpace = NoColorSpace;
  const supportBounds = new Vector4(supportLayout.minX / 1000, supportLayout.minY / 1000,
    supportLayout.width / 1000, supportLayout.height / 1000);
  const structuralLayout = structuralMarginMm === undefined ? null : zoneMapLayout(regions, structuralMarginMm);
  const structuralTexture = structuralLayout ? new CanvasTexture(drawZoneMap(regions, structuralLayout, structuralMarginMm)) : null;
  if (structuralTexture) { structuralTexture.flipY = false; structuralTexture.colorSpace = NoColorSpace; }
  const structuralBounds = structuralLayout ? new Vector4(structuralLayout.minX / 1000, structuralLayout.minY / 1000,
    structuralLayout.width / 1000, structuralLayout.height / 1000) : null;
  const copies = new Map<Material, Material>();
  const supportCopies = new Map<Material, Material>();
  const structuralCopies = new Map<Material, Material>();
  const changed: { mesh: Mesh; material: Material | Material[] }[] = [];
  const furniture: { group: Object3D; visible: boolean }[] = [];
  const clipped = (original: Material, support = false, structural = false): Material => {
    const cache = structural ? structuralCopies : support ? supportCopies : copies;
    const existing = cache.get(original);
    if (existing) return existing;
    const copy = original.clone();
    const beforeCompile = original.onBeforeCompile;
    copy.onBeforeCompile = (shader, renderer) => {
      beforeCompile.call(copy, shader, renderer);
      clipShaderToZone(shader, structural ? structuralTexture! : support ? supportTexture : texture,
        structural ? structuralBounds! : support ? supportBounds : bounds);
    };
    copy.customProgramCacheKey = () => `${original.customProgramCacheKey()}|habiteka-zone-${structural ? 'structural' : support ? 'support' : 'standard'}-v1`;
    cache.set(original, copy);
    return copy;
  };
  const restore = () => {
    changed.forEach(({ mesh, material }) => { mesh.material = material; });
    furniture.forEach(({ group, visible }) => { group.visible = visible; });
    copies.forEach((copy) => copy.dispose());
    supportCopies.forEach((copy) => copy.dispose());
    structuralCopies.forEach((copy) => copy.dispose());
    structuralTexture?.dispose();
    supportTexture.dispose();
    texture.dispose();
  };
  try {
    scene.updateMatrixWorld(true);
    scene.traverse((object) => {
      // La ortofoto es el entorno real. El tejado conserva sus aleros aprobados.
      if (video && hasLayer(object, 'geographicBackground', 'roofLayer')) return;
      if (video && object.userData.videoStage === -1 && hideTerrain) {
        furniture.push({ group: object, visible: object.visible }); object.visible = false;
      }
      if (video && object.userData.videoStage === 1) {
        furniture.push({ group: object, visible: object.visible });
        object.visible = object.visible && furnitureBelongsToZone(object, regions);
      }
      if (object.userData.videoStage === 3) {
        furniture.push({ group: object, visible: object.visible });
        object.visible = object.visible && furnitureBelongsToZone(object, regions);
      }
      if (!(object instanceof Mesh)) return;
      // Un muro interior o de fachada conservado necesita sus dos caras completas.
      // Se excluyen antes los grupos estructurales que están fuera de la casa.
      if (video && hasLayer(object, 'cutawayStructural')) return;
      if (!video && belongsToFurnitureGroup(object)) return;
      const material = object.material;
      changed.push({ mesh: object, material });
      const support = cutawaySupportHeight(object) !== undefined || (video && hasLayer(object, 'cutawayWallId'));
      const structural = Boolean(structuralTexture && belongsToZoneStructure(object));
      object.material = Array.isArray(material) ? material.map((item) => clipped(item, support, structural))
        : clipped(material, support, structural);
    });
  } catch (error) {
    restore();
    throw error;
  }
  return restore;
}

function hasLayer(object: Object3D, ...keys: string[]) {
  for (let current: Object3D | null = object; current; current = current.parent)
    if (keys.some(key => current!.userData[key])) return true;
  return false;
}
