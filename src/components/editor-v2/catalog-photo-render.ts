'use client';
import { Box3, CanvasTexture, Color, DirectionalLight, Group, HemisphereLight, Mesh, MeshBasicMaterial, PerspectiveCamera,
  PlaneGeometry, Scene, ShadowMaterial, Vector3, type Object3D } from 'three';
import { prepareFurnitureModel } from '@/canvas/editor-v2/scene/furniture-model-transform';
import type { RenderedPhotoSource } from '@/canvas/editor-v2/scene/catalog-photo-subjects';
import { framePhotoCamera, type PhotoView } from '@/canvas/editor-v2/scene/catalog-photo-framing';
import { inPhotoStudio, loadStudioModel, type PhotoStudio } from './photo-studio';
import { sceneBoxesObject } from './scene-box-object';

/** El doble de la tarjeta (unos 168 × 112 px): nítida en pantallas retina sin pesar más de unos pocos kB. */
export const CATALOG_PHOTO_SIZE = { width: 336, height: 224 } as const;
/** Fondo claro neutro de ficha de producto; la tarjeta usa el mismo mientras carga. */
export const CATALOG_PHOTO_BACKGROUND = '#f2f0ec';

let contactTexture: CanvasTexture | null = null;
/** Mancha radial difusa bajo la pieza: la sombra de contacto que la apoya en el suelo. */
function contactShadowTexture(): CanvasTexture {
  if (contactTexture) return contactTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('El navegador no permite dibujar la sombra de contacto');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(0,0,0,1)');
  gradient.addColorStop(.55, 'rgba(0,0,0,.45)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  contactTexture = new CanvasTexture(canvas);
  return contactTexture;
}

/** Pieza lista para la foto, con su limpieza: el GLB se clona y los sólidos se construyen solo para esta foto. */
async function photoSubject(source: RenderedPhotoSource): Promise<{ object: Object3D; dispose: () => void }> {
  if (source.kind === 'boxes') return sceneBoxesObject(source.boxes);
  const model = await loadStudioModel(source.url);
  const prepared = prepareFurnitureModel(model, source.frontRotation, source.tint, 8, source.tintMaterialNames);
  const holder = new Group();
  holder.scale.set(...source.sizeM);
  holder.add(prepared.object);
  return { object: holder, dispose: prepared.dispose };
}

/**
 * Foto de ficha de producto del mismo 3D que se ve en la escena: vista 3/4 en perspectiva, luz de estudio suave con
 * el entorno de interior del editor, sombra de contacto difusa y fondo claro neutro. Devuelve la imagen codificada
 * (WebP si el navegador lo permite) para guardarla en la caché del navegador.
 */
export async function captureCatalogPhoto(source: RenderedPhotoSource): Promise<Blob> {
  const subject = await photoSubject(source);
  try {
    return await inPhotoStudio((studio) => shoot(studio, subject.object, source.front, source.view));
  } finally {
    subject.dispose();
  }
}

async function shoot({ renderer, environment }: PhotoStudio, object: Object3D, front: 1 | -1, view: PhotoView): Promise<Blob> {
  const scene = new Scene(), disposables: { dispose: () => void }[] = [];
  scene.background = new Color(CATALOG_PHOTO_BACKGROUND);
  scene.environment = environment;
  scene.environmentIntensity = .8;
  // La cara de delante mira a la cámara; la pieza queda centrada y apoyada en el suelo (y = 0).
  const holder = new Group();
  holder.add(object);
  holder.rotation.y = front < 0 ? Math.PI : 0;
  holder.updateMatrixWorld(true);
  const raw = new Box3().setFromObject(holder);
  if (raw.isEmpty()) throw new Error('La pieza no tiene volumen que fotografiar');
  const center = raw.getCenter(new Vector3());
  holder.position.set(-center.x, -raw.min.y, -center.z);
  holder.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(holder), size = bounds.getSize(new Vector3());
  const reach = Math.max(size.x, size.y, size.z, .05);
  scene.add(holder, new HemisphereLight(0xffffff, 0xe6e0d6, .55));

  // Luz principal alta y algo lateral: modela volúmenes y deja una sombra suave detrás de la pieza.
  const key = new DirectionalLight(0xffffff, 1.5);
  key.position.set(-.7 * reach, 2.2 * reach + size.y, 1.1 * reach);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 10;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -.0005;
  const extent = reach * 1.4;
  Object.assign(key.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: .01, far: reach * 8 + size.y * 2 });
  key.shadow.camera.updateProjectionMatrix();
  const fill = new DirectionalLight(0xffffff, .35);
  fill.position.set(1.2 * reach, .8 * reach, 1.4 * reach);
  scene.add(key, key.target, fill);

  const floorGeometry = new PlaneGeometry(reach * 10, reach * 10), floorMaterial = new ShadowMaterial({ opacity: .16 });
  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const contactGeometry = new PlaneGeometry(size.x * 1.25 + .08, size.z * 1.25 + .08);
  const contactMaterial = new MeshBasicMaterial({ map: contactShadowTexture(), color: 0x000000, transparent: true, opacity: .22, depthWrite: false });
  const contact = new Mesh(contactGeometry, contactMaterial);
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = .001;
  scene.add(floor, contact);
  disposables.push(floorGeometry, floorMaterial, contactGeometry, contactMaterial);

  try {
    const { width, height } = CATALOG_PHOTO_SIZE;
    const framing = framePhotoCamera({ min: bounds.min.toArray(), max: bounds.max.toArray() }, view, width / height);
    const camera = new PerspectiveCamera(framing.fovDeg, framing.aspect, framing.near, framing.far);
    camera.position.set(...framing.position);
    camera.up.set(...framing.up);
    camera.lookAt(...framing.target);
    renderer.setSize(width, height, false);
    renderer.toneMappingExposure = 1;
    renderer.setClearColor(CATALOG_PHOTO_BACKGROUND, 1);
    renderer.render(scene, camera);
    return await encode(renderer.domElement);
  } finally {
    key.shadow.dispose();
    disposables.forEach((item) => item.dispose());
  }
}

function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob)
    : reject(new Error('No se pudo codificar la foto del catálogo')), 'image/webp', .9));
}
