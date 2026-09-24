/**
 * Escenas de iluminación como capa NO destructiva: los valores nominales de
 * cada luminaria y cada tira (`temperatureK`, `lumens`, `lumensPerMeter`) no se
 * tocan nunca. La escena activa de una estancia se aplica al resolver, así que
 * el 2D, el 3D y la IA ven el ambiente elegido mientras el panel sigue editando
 * los valores reales del proyecto.
 *
 * Sin escena activa las funciones efectivas son la identidad.
 */
import type { EditorDocument, LightingScene, LightStrip, Luminaire } from './schema';
import { STRIP_LUMENS_PER_METER_RANGE } from './light-strip-types';
import { LUMINAIRE_LUMENS_RANGE } from './ceiling-validation';
// Ciclo de módulos tolerado: solo se usa dentro de funciones, nunca al cargar.
import { stripRoomId } from './light-strip-geometry';
import { ceilingSurfaces } from './ceiling-geometry';
import { deriveRoomsSafe } from './rooms';

/** Valores de partida de una escena nueva; un solo sitio para comandos y UI. */
export const SCENE_DEFAULTS = { temperatureK: 3000, intensityPct: 100 } as const;

const clamp = (value: number, [min, max]: readonly [number, number]) => Math.max(min, Math.min(max, value));

export function activeSceneForRoom(doc: EditorDocument, roomId: string | null | undefined): LightingScene | null {
  if (!roomId) return null;
  return doc.lightingScenes?.find((scene) => scene.active && scene.roomId === roomId) ?? null;
}

/** Escenas guardadas de una estancia, en el orden en que se guardaron. */
export function scenesForRoom(doc: EditorDocument, roomId: string | null | undefined): LightingScene[] {
  if (!roomId) return [];
  return (doc.lightingScenes ?? []).filter((scene) => scene.roomId === roomId);
}

export interface EffectiveLuminaire { temperatureK: number; lumens: number; enabled: boolean }
export interface EffectiveStrip { temperatureK: number; lumensPerMeter: number; enabled: boolean }

export function effectiveLuminaire(
  light: Pick<Luminaire, 'id' | 'temperatureK' | 'lumens' | 'enabled'>,
  scene: LightingScene | null,
): EffectiveLuminaire {
  if (!scene) return { temperatureK: light.temperatureK, lumens: light.lumens, enabled: light.enabled };
  return {
    temperatureK: scene.temperatureK,
    // El acotado es solo para el cálculo: el documento conserva su valor nominal.
    lumens: clamp(Math.round(light.lumens * scene.intensityPct / 100), LUMINAIRE_LUMENS_RANGE),
    enabled: light.enabled && !scene.offLightIds.includes(light.id),
  };
}

export function effectiveStrip(
  strip: Pick<LightStrip, 'id' | 'temperatureK' | 'lumensPerMeter' | 'enabled'>,
  scene: LightingScene | null,
): EffectiveStrip {
  if (!scene) return { temperatureK: strip.temperatureK, lumensPerMeter: strip.lumensPerMeter, enabled: strip.enabled };
  return {
    temperatureK: scene.temperatureK,
    lumensPerMeter: clamp(Math.round(strip.lumensPerMeter * scene.intensityPct / 100), STRIP_LUMENS_PER_METER_RANGE),
    enabled: strip.enabled && !scene.offStripIds.includes(strip.id),
  };
}

/**
 * Luminarias de una estancia: pertenecen a un techo y el techo a la estancia.
 * Se usa la relación guardada (`Ceiling.roomId`) y no la geometría resuelta,
 * para que una luminaria con incidencias siga contando como suya.
 */
export function roomLuminaires(doc: EditorDocument, roomId: string): Luminaire[] {
  const ceilingIds = new Set((doc.ceilings ?? []).filter((ceiling) => ceiling.roomId === roomId).map((ceiling) => ceiling.id));
  return (doc.luminaires ?? []).filter((light) => ceilingIds.has(light.ceilingId));
}

/** Tiras de una estancia; delega en la resolución de estancia de las tiras (fase 3). */
export function roomStrips(doc: EditorDocument, roomId: string): LightStrip[] {
  if (!doc.lightStrips?.length) return [];
  // Superficies y estancias se derivan una vez para todas las tiras, no una por tira.
  const surfaces = ceilingSurfaces(doc), rooms = deriveRoomsSafe(doc);
  return doc.lightStrips.filter((strip) => stripRoomId(doc, strip, surfaces, rooms) === roomId);
}

/**
 * Ambiente actual de la estancia convertido en escena: la temperatura dominante
 * entre sus luces y tiras, intensidad al 100 % (los lúmenes nominales) y lo que
 * está apagado ahora mismo.
 */
export function captureScene(doc: EditorDocument, roomId: string, name: string): Omit<LightingScene, 'id'> {
  const lights = roomLuminaires(doc, roomId), strips = roomStrips(doc, roomId);
  if (!lights.length && !strips.length) throw new Error('La estancia no tiene luces ni tiras que guardar');
  const counts = new Map<number, number>();
  for (const { temperatureK } of [...lights, ...strips]) counts.set(temperatureK, (counts.get(temperatureK) ?? 0) + 1);
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
  return {
    roomId,
    name: name.trim(),
    temperatureK: dominant ?? SCENE_DEFAULTS.temperatureK,
    intensityPct: SCENE_DEFAULTS.intensityPct,
    offLightIds: lights.filter((light) => !light.enabled).map((light) => light.id),
    offStripIds: strips.filter((strip) => !strip.enabled).map((strip) => strip.id),
    active: true,
  };
}

/**
 * Quita de las escenas los ids de luces o tiras que ya no existen. Lo llaman
 * los comandos de borrado: una escena con un id huérfano no valida.
 */
export function pruneLightingScenes(doc: EditorDocument): void {
  if (!doc.lightingScenes?.length) return;
  const lightIds = new Set((doc.luminaires ?? []).map((light) => light.id));
  const stripIds = new Set((doc.lightStrips ?? []).map((strip) => strip.id));
  doc.lightingScenes = doc.lightingScenes.map((scene) => ({
    ...scene,
    offLightIds: scene.offLightIds.filter((id) => lightIds.has(id)),
    offStripIds: scene.offStripIds.filter((id) => stripIds.has(id)),
  }));
}
