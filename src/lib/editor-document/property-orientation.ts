import { z } from 'zod';
import type { LightingPreset } from '@/lib/lighting-preset';
import type { EditorDocument } from './schema';
import { parseEditorDocument } from './validation';

export type SolarPreset = Exclude<LightingPreset, 'evening'>;
export const SUN_DEFAULTS = {
  daylight: { azimuthDeg: 180, elevationDeg: 55 },
  afternoon: { azimuthDeg: 225, elevationDeg: 30 },
  warm: { azimuthDeg: 270, elevationDeg: 12 },
} satisfies Record<SolarPreset, SunPosition>;
const sunPositionSchema = z.object({
  /** Dirección de donde llega el sol: N=0°, E=90°, S=180°, O=270°. */
  azimuthDeg: z.number().finite().min(0).max(360),
  elevationDeg: z.number().finite().min(1).max(90),
}).strict();
export type SunPosition = z.infer<typeof sunPositionSchema>;
export const propertyOrientationSchema = z.object({
  /** Flecha del norte en el plano: 0° arriba, 90° derecha; giro horario. */
  northDeg: z.number().finite().min(0).max(360),
  sunlight: z.object({ daylight: sunPositionSchema.optional(), afternoon: sunPositionSchema.optional(),
    warm: sunPositionSchema.optional() }).strict().optional(),
}).strict();
export type PropertyOrientation = z.infer<typeof propertyOrientationSchema>;
export const normalizeBearing = (angle: number) => ((angle % 360) + 360) % 360;
export function siteRotationForNorth(northDeg: number): number {
  const angle = normalizeBearing(-northDeg);
  return angle > 180 ? angle - 360 : angle;
}

/** La ortofoto tiene norte arriba: el norte del plano es el inverso del giro de su encaje. */
export function propertyNorth(doc: Pick<EditorDocument, 'propertyOrientation' | 'geographicSite'>): number | undefined {
  return doc.geographicSite ? normalizeBearing(-doc.geographicSite.rotationDeg)
    : doc.propertyOrientation ? normalizeBearing(doc.propertyOrientation.northDeg) : undefined;
}
export function propertySun(doc: Pick<EditorDocument, 'propertyOrientation' | 'geographicSite'>, preset: LightingPreset): SunPosition | undefined {
  if (preset === 'evening' || propertyNorth(doc) === undefined) return undefined;
  return doc.propertyOrientation?.sunlight?.[preset] ?? SUN_DEFAULTS[preset];
}
/** Vector hacia la fuente solar: +X derecha, +Z abajo en el plano y +Y altura en Three.js. */
export function sunDirection(northDeg: number, sun: SunPosition): [number, number, number] {
  const angle = (northDeg + sun.azimuthDeg) * Math.PI / 180, height = sun.elevationDeg * Math.PI / 180;
  return [Math.sin(angle) * Math.cos(height), Math.sin(height), -Math.cos(angle) * Math.cos(height)];
}
export function setPropertyOrientation(input: EditorDocument, patch: Partial<PropertyOrientation>): EditorDocument {
  const northDeg = normalizeBearing(patch.northDeg ?? propertyNorth(input) ?? 0);
  const orientation = propertyOrientationSchema.parse({ ...input.propertyOrientation, ...patch, northDeg });
  const doc = structuredClone(input);
  doc.propertyOrientation = orientation;
  if (doc.geographicSite && patch.northDeg !== undefined && northDeg !== propertyNorth(input)) {
    doc.geographicSite.rotationDeg = siteRotationForNorth(northDeg);
    doc.geographicSite.confirmed = false;
  }
  if (doc.geographicSite && JSON.stringify(orientation.sunlight) !== JSON.stringify(input.propertyOrientation?.sunlight))
    doc.geographicSite.confirmed = false;
  if (JSON.stringify(doc) === JSON.stringify(input)) return input;
  doc.revision += 1;
  return parseEditorDocument(doc);
}

const PLAN_DIRECTIONS = ['arriba', 'arriba a la derecha', 'derecha', 'abajo a la derecha', 'abajo',
  'abajo a la izquierda', 'izquierda', 'arriba a la izquierda'];
/** Instrucción breve compartida por las imágenes: no afirma un cálculo por coordenadas, fecha u hora. */
export function propertySunPrompt(doc: Pick<EditorDocument, 'propertyOrientation' | 'geographicSite'>, preset: LightingPreset): string {
  const north = propertyNorth(doc);
  if (north === undefined) return '';
  if (preset === 'evening') return 'Escena nocturna: sin sol ni sombras solares; las sombras de las luminarias siguen sus fuentes reales.';
  const sun = propertySun(doc, preset)!;
  const angle = normalizeBearing(north + sun.azimuthDeg);
  const direction = PLAN_DIRECTIONS[Math.round(angle / 45) % 8];
  const shadow = PLAN_DIRECTIONS[Math.round(normalizeBearing(angle + 180) / 45) % 8];
  return `ORIENTACIÓN Y SOL: norte ${Math.round(north)}° horario desde arriba del plano original; sol desde ${Math.round(sun.azimuthDeg)}° respecto al norte, altura ${Math.round(sun.elevationDeg)}°. En ese plano, antes del giro de las referencias, llega desde ${direction} y proyecta sombras hacia ${shadow}. En otras cámaras conserva esa misma dirección física, sin girar el sol con la cámara.`;
}
