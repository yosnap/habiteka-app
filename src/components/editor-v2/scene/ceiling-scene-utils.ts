import { Color, Shape, SpotLight } from 'three';
import type { Luminaire, Point } from '@/lib/editor-document/schema';

export type CeilingView = 'hidden' | 'transparent' | 'solid';
export const MAX_LUMINAIRE_LIGHTS = 12;

export function captureCeilingView(view: string | null | undefined, custom?: {
  cutaway: boolean; cameraHeightM: number; highestCeilingM: number | null;
  /** Captura para diseñar con IA: desde encima del techo la IA vería una losa, no el interior. */
  forDesign?: boolean;
}): CeilingView {
  if (view === 'top' || view === 'isometric' || view === 'drone') return 'hidden';
  if ((!view || view === 'current' || view === 'custom') && (custom?.cutaway || custom?.forDesign) &&
    custom.highestCeilingM !== null && custom.cameraHeightM > custom.highestCeilingM) return 'hidden';
  return 'solid';
}

/**
 * Los alzados e isométrica miran la planta desde fuera: sin recorte solo se ve
 * la fachada. En esas capturas se ocultan los muros exteriores hacia la cámara
 * aunque el 3D de trabajo los muestre; el resto respeta la elección del usuario.
 */
export function captureCutaway(view: string | null | undefined, cutaway: boolean): boolean {
  if (view === 'front' || view === 'back' || view === 'left' || view === 'right' || view === 'isometric') return true;
  return cutaway;
}

/** El plano usa milímetros X/Y; Three usa metros X/Z. */
export function ceilingShape(boundary: Point[]): Shape {
  const shape = new Shape();
  boundary.forEach((point, index) => index
    ? shape.lineTo(point.x / 1000, -point.y / 1000)
    : shape.moveTo(point.x / 1000, -point.y / 1000));
  shape.closePath();
  return shape;
}

/** Aproximación del color de un radiador térmico para iluminación arquitectónica. */
export function temperatureColor(kelvin: number): Color {
  const t = Math.max(1000, Math.min(40000, kelvin)) / 100;
  const clamp = (value: number) => Math.max(0, Math.min(255, value));
  const red = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -.1332047592;
  const green = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -.0755148492;
  const blue = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return new Color().setRGB(clamp(red) / 255, clamp(green) / 255, clamp(blue) / 255, 'srgb');
}

/** Emisor bajo el difusor: el destino comparte el grupo/planta de la luminaria. */
export function createLuminaireEmitter(luminaire: Luminaire): SpotLight {
  const light = new SpotLight(temperatureColor(luminaire.temperatureK));
  light.power = luminaire.lumens;
  light.position.set(0, -.025, 0);
  light.target.position.set(0, -1, 0);
  light.angle = (luminaire.kind === 'recessed' ? 50 : luminaire.kind === 'flush' ? 80 : 65) * Math.PI / 180;
  light.penumbra = .5;
  light.decay = 2;
  light.distance = 12;
  light.castShadow = true;
  light.shadow.mapSize.set(512, 512);
  light.shadow.camera.near = .02;
  light.shadow.camera.far = 12;
  light.shadow.bias = -.0001;
  light.shadow.normalBias = .005;
  return light;
}
