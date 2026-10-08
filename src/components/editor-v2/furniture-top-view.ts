'use client';
import { useSyncExternalStore } from 'react';
import { DirectionalLight, Group, HemisphereLight, OrthographicCamera, Scene, type Object3D } from 'three';
import type { Furniture } from '@/lib/editor-document/schema';
import { furnitureModel, modelTint } from '@/lib/editor-document/furniture-models';
import { furnitureSpatial } from '@/lib/editor-document/spatial-properties';
import { prepareFurnitureModel } from '@/canvas/editor-v2/scene/furniture-model-transform';
import { inPhotoStudio, loadStudioModel, type PhotoStudio } from './photo-studio';
import { isPorch, isPorchAddon, porchPlanDepth } from '@/lib/editor-document/porch-volumes';
import { furnitureSceneBoxes } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { sceneBoxesObject } from './scene-box-object';

/** Píxeles por milímetro de la vista cenital: una cama de 2 m sale a 500 px, nítida al acercarse. */
const PX_PER_MM = .25;
const MAX_SIDE = 640;

const images = new Map<string, HTMLImageElement | null>();
const pending = new Set<string>();
const listeners = new Set<() => void>();

const topViewKey = (item: Furniture) => {
  const asset = furnitureModel(item);
  return asset ? `${asset.url}|${modelTint(item) ?? ''}|${Math.round(item.widthMm)}|${Math.round(item.depthMm)}${isPorch(item) ? `|${item.elevationMm ?? 0}|${item.heightMm}|${!!item.porchSteps}` : ''}` : null;
};

/**
 * Vista cenital realista de un mueble con modelo 3D: el mismo GLB del 3D, con sus texturas, fotografiado desde arriba
 * con cámara ortogonal. Se renderiza una vez por modelo, color y medidas, en el navegador, y se guarda en memoria.
 * Mientras no está lista (o si el modelo falla) devuelve null y el plano dibuja el símbolo de siempre.
 */
export function useFurnitureTopView(item: Furniture | null): HTMLImageElement | null {
  const key = item ? topViewKey(item) : null;
  return useSyncExternalStore(subscribe, () => {
    if (!key || !item) return null;
    if (!images.has(key) && !pending.has(key)) request(item, key);
    return images.get(key) ?? null;
  }, () => null);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function request(item: Furniture, key: string) {
  const asset = furnitureModel(item);
  if (typeof window === 'undefined' || !asset) return;
  pending.add(key);
  // El GLB se descarga en paralelo; la foto, en la cola única del estudio.
  loadStudioModel(asset.url).then((model) => inPhotoStudio((studio) => render(studio, item, model)))
    .then((image) => { images.set(key, image); })
    .catch((error: unknown) => { images.set(key, null); console.warn('Vista cenital no disponible; se dibuja el símbolo', key, error); })
    .finally(() => { pending.delete(key); listeners.forEach((listener) => listener()); });
}

async function render({ renderer, environment }: PhotoStudio, item: Furniture, model: Object3D): Promise<HTMLImageElement | null> {
  const asset = furnitureModel(item);
  if (!asset) return null;
  const spatial = furnitureSpatial(item);
  const prepared = prepareFurnitureModel(model, asset.frontRotation, modelTint(item), 8, asset.tintMaterialNames);
  let addons: Awaited<ReturnType<typeof sceneBoxesObject>> | null = null;
  try {
    if (isPorch(item)) addons = await sceneBoxesObject(furnitureSceneBoxes({ ...item, x: -item.widthMm / 2, y: -item.depthMm / 2, rotation: 0 })
      .filter((box) => isPorchAddon(box.boundaryPart)));
    const width = item.widthMm / 1000, depth = porchPlanDepth(item) / 1000, height = (spatial.heightMm + (isPorch(item) ? spatial.elevationMm : 0)) / 1000;
    const holder = new Group();
    holder.scale.set(width, spatial.heightMm / 1000, item.depthMm / 1000);
    if (isPorch(item)) holder.position.y = spatial.elevationMm / 1000;
    holder.add(prepared.object);
    const scene = new Scene();
    scene.environment = environment;
    scene.add(holder, new HemisphereLight(0xffffff, 0x9a948c, .55));
    if (addons) scene.add(addons.object);
    // Luz desde arriba, un poco ladeada: da relieve a cojines, almohadas y tapas sin sombras duras.
    const sun = new DirectionalLight(0xffffff, 1.1);
    sun.position.set(-1.2, 4, -1.6);
    scene.add(sun);
    const camera = new OrthographicCamera(-width / 2, width / 2, depth / 2, -depth / 2, .01, height + 20);
    // Mirando hacia abajo con «arriba» hacia -Z: la imagen queda como el plano (x a la derecha, y del plano hacia abajo).
    const frontOffset = (depth - item.depthMm / 1000) / 2;
    camera.position.set(0, height + 10, frontOffset);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, frontOffset);
    const scale = Math.min(PX_PER_MM, MAX_SIDE / Math.max(item.widthMm, porchPlanDepth(item)));
    renderer.setSize(Math.max(16, Math.round(item.widthMm * scale)), Math.max(16, Math.round(porchPlanDepth(item) * scale)), false);
    // Fondo transparente: el plano dibuja la foto sobre su suelo.
    renderer.toneMappingExposure = .95;
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);
    const image = new Image();
    image.src = renderer.domElement.toDataURL('image/png');
    await image.decode();
    return image;
  } finally {
    prepared.dispose();
    addons?.dispose();
  }
}
