'use client';
import { BoxGeometry, Color, CylinderGeometry, Group, LinearMipmapLinearFilter, Mesh, MeshStandardMaterial, NoColorSpace,
  RepeatWrapping, SphereGeometry, SRGBColorSpace, TextureLoader, type BufferGeometry, type Material, type Texture } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { SceneBox } from '@/canvas/editor-v2/scene/types';
import { surfaceMaterial, surfaceMaterialAppearance } from '@/lib/editor-document/surface-materials';
import { createHipRoofGeometry } from './scene/hip-roof-geometry';

/** Texturas originales por URL: se descargan una vez y cada material usa un clon con su propia repetición. */
const textures = new Map<string, Promise<Texture>>();
const loader = new TextureLoader();

function loadTexture(url: string): Promise<Texture> {
  let texture = textures.get(url);
  if (!texture) {
    texture = loader.loadAsync(url);
    textures.set(url, texture);
    texture.catch(() => { textures.delete(url); });
  }
  return texture;
}

interface Built { object: Group; dispose: () => void }

/**
 * Los mismos sólidos que pinta la escena 3D (`BoxMesh`), en three.js sin React, para fotografiarlos fuera de la
 * escena: formas, colores por cara, vidrio, agua y los materiales de la biblioteca con su textura. Si una textura
 * no carga, esa cara se queda con su color, igual que en el 3D.
 */
export async function sceneBoxesObject(boxes: readonly SceneBox[]): Promise<Built> {
  const object = new Group(), geometries: BufferGeometry[] = [], materials: Material[] = [], clones: Texture[] = [];
  const textured = async (id: string | undefined, color: string, width: number, height: number, useColorMap?: boolean) => {
    const asset = surfaceMaterial(id);
    if (!asset) return null;
    const appearance = surfaceMaterialAppearance(id), showColorMap = !appearance && useColorMap !== false;
    try {
      const originals = await Promise.all((showColorMap ? [asset.maps.color, asset.maps.normal, asset.maps.roughness]
        : [asset.maps.normal, asset.maps.roughness]).map(loadTexture));
      const sizeX = asset.sizeMm[0]! / 1000, sizeY = sizeX * asset.sizeMm[1]! / asset.sizeMm[0]!;
      const maps = originals.map((original, index) => {
        const texture = original.clone();
        texture.colorSpace = showColorMap && index === 0 ? SRGBColorSpace : NoColorSpace;
        texture.wrapS = texture.wrapT = RepeatWrapping;
        texture.minFilter = LinearMipmapLinearFilter;
        texture.repeat.set(width / sizeX, height / sizeY);
        texture.needsUpdate = true;
        clones.push(texture);
        return texture;
      });
      const base = appearance ? new Color(color).multiply(new Color(appearance.baseColor)) : new Color(color);
      return new MeshStandardMaterial({ color: base, map: showColorMap ? maps[0] : null, normalMap: maps[showColorMap ? 1 : 0],
        roughnessMap: maps[showColorMap ? 2 : 1], roughness: 1 });
    } catch {
      return null;
    }
  };
  const plain = (box: SceneBox, color: string) => {
    const clear = box.role === 'glass' || box.opacity !== undefined;
    const metal = box.appearance === 'powder-coated-metal';
    // three avisa de cada parámetro `undefined`: el brillo propio solo se pasa si la pieza lo lleva (tira LED).
    return new MeshStandardMaterial({ color, ...(box.emissive ? { emissive: new Color(box.emissive), emissiveIntensity: 2 } : {}),
      roughness: metal ? .42 : box.role === 'glass' ? .08 : box.role === 'seal' ? .38 : box.shape === 'hip-roof' ? .92 : .7,
      metalness: metal ? .65 : box.role === 'rail' ? .5 : box.role === 'glass' ? .18 : box.role === 'seal' ? .12 : 0,
      envMapIntensity: box.role === 'glass' ? 1.6 : 1, transparent: clear, opacity: box.opacity ?? (box.role === 'glass' ? .38 : 1),
      depthWrite: !clear });
  };
  const materialFor = async (box: SceneBox): Promise<Material | Material[]> => {
    if (box.appearance === 'water') {
      return new MeshStandardMaterial({ color: box.color, roughness: .08, metalness: .1, transparent: true, opacity: .82 });
    }
    if (box.materialId) {
      const height = box.shape === 'hip-roof' ? box.size[2] : box.size[1];
      return await textured(box.materialId, box.color, box.size[0], height, box.useColorMap) ?? plain(box, box.color);
    }
    if (!box.sideColors && !box.topMaterialId && !box.bodyMaterialId) return plain(box, box.color);
    // Caras de BoxGeometry: +X, −X, arriba, abajo, +Z, −Z (el mismo orden que en la escena).
    const colors = box.sideColors ? [box.color, box.color, box.topColor ?? box.color, box.color, box.sideColors[0], box.sideColors[1]]
      : Array.from({ length: 6 }, () => box.color);
    return Promise.all(colors.map(async (color, index) => {
      const id = index === 2 ? box.topMaterialId : box.bodyMaterialId ?? (index >= 4 ? box.sideMaterials?.[index - 4] : undefined);
      const width = index < 2 ? box.size[2] : box.size[0], height = index === 2 || index === 3 ? box.size[2] : box.size[1];
      return await textured(id, box.bodyMaterialId && index !== 2 ? '#ffffff' : color, width, height) ?? plain(box, color);
    }));
  };
  const geometryFor = (box: SceneBox): BufferGeometry => {
    const [width, height, depth] = box.size;
    switch (box.shape) {
      case 'cylinder': return new CylinderGeometry(width / 2, width / 2, height, 24);
      case 'hip-roof': return createHipRoofGeometry(width, height, depth);
      case 'rounded-box': return new RoundedBoxGeometry(width, height, depth, 3, Math.min(width, height, depth) * .2);
      case 'ellipsoid': return new SphereGeometry(.5, 20, 12);
      default: return new BoxGeometry(width, height, depth);
    }
  };
  const meshes = await Promise.all(boxes.map(async (box) => {
    const geometry = geometryFor(box), material = await materialFor(box);
    geometries.push(geometry);
    materials.push(...(Array.isArray(material) ? material : [material]));
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...box.position);
    mesh.rotation.y = box.rotation;
    if (box.shape === 'ellipsoid') mesh.scale.set(...box.size);
    mesh.castShadow = !(box.role === 'glass' || box.opacity !== undefined || box.appearance === 'water');
    mesh.receiveShadow = true;
    return mesh;
  }));
  if (meshes.length) object.add(...meshes);
  return { object, dispose: () => {
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    clones.forEach((texture) => texture.dispose());
  } };
}
