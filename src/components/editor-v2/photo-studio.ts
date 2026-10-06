'use client';
import { ACESFilmicToneMapping, PMREMGenerator, SRGBColorSpace, VSMShadowMap, WebGLRenderer, type Object3D, type Texture } from 'three';
// El mismo cargador y decodificador meshopt que usa el 3D del editor (drei): con el de three la decodificación no acababa.
import { GLTFLoader, MeshoptDecoder } from 'three-stdlib';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Un modelo o una foto que no termina en este tiempo no bloquea a los demás: se queda con su respaldo. */
const STUDIO_TIMEOUT_MS = 15_000;

export interface PhotoStudio { renderer: WebGLRenderer; loader: GLTFLoader; environment: Texture }

let shared: PhotoStudio | null = null;
let queue: Promise<unknown> = Promise.resolve();
/** Cada GLB se descarga y se decodifica una sola vez, en paralelo con las fotos; un fallo no se queda guardado. */
const models = new Map<string, Promise<Object3D>>();

/**
 * Estudio fotográfico offscreen del editor: un único contexto WebGL con el mismo entorno de interior que el 3D, de
 * modo que madera, tela y metal se vean igual que en la escena. Lo comparten la vista cenital del plano y las fotos
 * del catálogo. Si el navegador pierde el contexto, el siguiente uso crea otro.
 */
export function photoStudio(): PhotoStudio {
  if (shared) return shared;
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = SRGBColorSpace;
  // Sin corrección de tono, la tela blanca y la madera clara salían quemadas.
  renderer.toneMapping = ACESFilmicToneMapping;
  // Sombras difuminadas (VSM) para la sombra de contacto de las fotos; la vista cenital no proyecta sombras.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = VSMShadowMap;
  const loader = new GLTFLoader().setMeshoptDecoder(typeof MeshoptDecoder === 'function' ? MeshoptDecoder() : MeshoptDecoder);
  const pmrem = new PMREMGenerator(renderer), environment = pmrem.fromScene(new RoomEnvironment(), .04);
  pmrem.dispose();
  const studio: PhotoStudio = { renderer, loader, environment: environment.texture };
  renderer.domElement.addEventListener('webglcontextlost', () => {
    if (shared === studio) shared = null;
    environment.dispose();
  }, { once: true });
  shared = studio;
  return studio;
}

/** Escena original de un GLB (no se modifica: quien la use debe clonarla, como hace `prepareFurnitureModel`). */
export function loadStudioModel(url: string): Promise<Object3D> {
  let model = models.get(url);
  if (!model) {
    model = photoStudio().loader.loadAsync(url).then((gltf) => gltf.scene);
    models.set(url, model);
    model.catch(() => { models.delete(url); });
  }
  return withStudioTimeout(model, 'El modelo tardó demasiado en cargarse');
}

/** Los renders se hacen de uno en uno: los modelos no compiten por el contexto WebGL ni por su tamaño de lienzo. */
export function inPhotoStudio<T>(work: (studio: PhotoStudio) => Promise<T> | T): Promise<T> {
  const run = queue.then(() => withStudioTimeout(Promise.resolve().then(() => work(photoStudio())), 'El render tardó demasiado'));
  queue = run.catch(() => undefined);
  return run;
}

function withStudioTimeout<T>(work: Promise<T>, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), STUDIO_TIMEOUT_MS); });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}
