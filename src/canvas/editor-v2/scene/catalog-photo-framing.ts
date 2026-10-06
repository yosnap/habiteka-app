/**
 * Encuadre de las fotos del catálogo: una cámara en perspectiva que mira la caja del objeto desde un ángulo fijo y se
 * aleja lo justo para que quepa entera con un margen, centrada en la imagen. Lógica pura en metros, sin three.js.
 */
export type Vec3 = [number, number, number];
export interface PhotoBounds { min: Vec3; max: Vec3 }
export interface PhotoView {
  /** Giro horizontal desde el frente (+Z), en grados; positivo hacia +X. */
  azimuthDeg: number;
  /** Altura de la cámara sobre la horizontal, en grados. */
  elevationDeg: number;
  /** Campo de visión vertical, en grados. */
  fovDeg: number;
  /** Fracción de cada mitad de la imagen que queda libre junto al borde. */
  margin: number;
}
export interface PhotoCamera { position: Vec3; target: Vec3; up: Vec3; fovDeg: number; aspect: number; near: number; far: number }

/** Ficha de producto: vista 3/4 desde delante y un poco desde arriba. */
export const FURNITURE_PHOTO_VIEW: PhotoView = { azimuthDeg: 34, elevationDeg: 22, fovDeg: 28, margin: .1 };
/** Puerta o ventana montada en su muro: casi de frente, en un 3/4 suave que deja ver el grueso de la hoja y sus herrajes. */
export const OPENING_PHOTO_VIEW: PhotoView = { azimuthDeg: 15, elevationDeg: 4, fovDeg: 26, margin: .05 };

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(...a));

function corners({ min, max }: PhotoBounds): Vec3[] {
  return [min[0], max[0]].flatMap((x) => [min[1], max[1]].flatMap((y) => [min[2], max[2]].map((z): Vec3 => [x, y, z])));
}

/** Ejes de la cámara: `toward` va del objetivo a la cámara; `right` y `up` son los de la imagen. */
function cameraAxes(view: PhotoView) {
  const azimuth = view.azimuthDeg * Math.PI / 180, elevation = view.elevationDeg * Math.PI / 180;
  const toward: Vec3 = [Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation)];
  const right = normalize(cross(scale(toward, -1), [0, 1, 0]));
  return { toward, right, up: cross(right, scale(toward, -1)) };
}

/** Coordenadas normalizadas (−1…1) de un punto en la imagen de la cámara; `depth` es su distancia por delante de ella. */
export function projectToImage(camera: PhotoCamera, point: Vec3): { x: number; y: number; depth: number } {
  const forward = normalize(sub(camera.target, camera.position));
  const right = normalize(cross(forward, camera.up)), up = cross(right, forward);
  const v = sub(point, camera.position), depth = dot(v, forward), tan = Math.tan(camera.fovDeg * Math.PI / 360);
  return { x: dot(v, right) / (depth * tan * camera.aspect), y: dot(v, up) / (depth * tan), depth };
}

/**
 * Cámara que encaja la caja entera con el margen pedido. Primero calcula la distancia que deja dentro todas las
 * esquinas; después desplaza el objetivo para centrar la silueta proyectada (una caja vista en 3/4 no es simétrica)
 * y vuelve a ajustar la distancia.
 */
export function framePhotoCamera(bounds: PhotoBounds, view: PhotoView, aspect: number): PhotoCamera {
  if (!(aspect > 0) || !(view.fovDeg > 0 && view.fovDeg < 180) || !(view.margin >= 0 && view.margin < 1)) {
    throw new Error('Encuadre de foto no válido');
  }
  if (![...bounds.min, ...bounds.max].every(Number.isFinite)) throw new Error('El objeto no tiene medidas válidas');
  const { toward, right, up } = cameraAxes(view), points = corners(bounds);
  const tanV = Math.tan(view.fovDeg * Math.PI / 360), tanH = tanV * aspect, usable = 1 - view.margin;
  const distanceFor = (target: Vec3) => Math.max(1e-3, ...points.map((p) => {
    const v = sub(p, target), along = dot(v, toward);
    return along + Math.max(Math.abs(dot(v, right)) / (tanH * usable), Math.abs(dot(v, up)) / (tanV * usable));
  }));
  let target: Vec3 = scale(add(bounds.min, bounds.max), .5), distance = distanceFor(target);
  for (let pass = 0; pass < 4; pass++) {
    const projected = points.map((p) => {
      const v = sub(p, target), depth = distance - dot(v, toward);
      return { x: dot(v, right) / (depth * tanH), y: dot(v, up) / (depth * tanV) };
    });
    const offsetX = (Math.max(...projected.map((p) => p.x)) + Math.min(...projected.map((p) => p.x))) / 2;
    const offsetY = (Math.max(...projected.map((p) => p.y)) + Math.min(...projected.map((p) => p.y))) / 2;
    target = add(target, add(scale(right, offsetX * distance * tanH), scale(up, offsetY * distance * tanV)));
    distance = distanceFor(target);
  }
  const depths = points.map((p) => distance - dot(sub(p, target), toward));
  return { position: add(target, scale(toward, distance)), target, up: [0, 1, 0], fovDeg: view.fovDeg, aspect,
    near: Math.max(.01, Math.min(...depths) * .5), far: Math.max(...depths) * 4 + 1 };
}
