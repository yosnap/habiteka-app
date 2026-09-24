/**
 * Comandos puros de escenas de iluminación. Suben el documento a v12 con
 * `upgradeLightingDocument`, cierran con `parseEditorDocument` y nunca tocan
 * los valores nominales de luces y tiras: guardar o aplicar una escena cambia
 * solo la escena.
 */
import type { EditorDocument, LightingScene } from './schema';
import { parseEditorDocument } from './validation';
import { upgradeLightingDocument } from './lighting-migration';
import { MAX_SCENE_NAME_LENGTH, MAX_SCENES_PER_ROOM } from './lighting-scene-validation';
import { captureScene, scenesForRoom } from './lighting-scene';

function find(doc: EditorDocument, id: string): LightingScene {
  const scene = doc.lightingScenes?.find((item) => item.id === id);
  if (!scene) throw new Error('Escena de iluminación inexistente');
  return scene;
}

function assertName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > MAX_SCENE_NAME_LENGTH)
    throw new Error(`Pon un nombre a la escena (1–${MAX_SCENE_NAME_LENGTH} caracteres)`);
  return trimmed;
}

/** Solo una escena activa por estancia: activar una apaga la anterior. */
function activateOnly(doc: EditorDocument, scene: LightingScene): void {
  doc.lightingScenes = doc.lightingScenes!.map((item) =>
    item.roomId !== scene.roomId ? item : { ...item, active: item.id === scene.id });
}

/** Guarda el ambiente actual de la estancia y lo deja activo. */
export function saveLightingScene(source: EditorDocument, roomId: string, name: string): EditorDocument {
  const doc = upgradeLightingDocument(source);
  const trimmed = assertName(name);
  if (scenesForRoom(doc, roomId).length >= MAX_SCENES_PER_ROOM)
    throw new Error(`Esta estancia ya tiene ${MAX_SCENES_PER_ROOM} escenas: borra una para guardar otra`);
  const scene: LightingScene = { id: crypto.randomUUID(), ...captureScene(doc, roomId, trimmed) };
  doc.lightingScenes!.push(scene);
  activateOnly(doc, scene);
  return parseEditorDocument(doc);
}

/** Aplica una escena guardada; un solo paso deshacible. */
export function applyLightingScene(source: EditorDocument, id: string): EditorDocument {
  const doc = upgradeLightingDocument(source);
  activateOnly(doc, find(doc, id));
  return parseEditorDocument(doc);
}

/** Devuelve la estancia a sus valores nominales, sin borrar la escena. */
export function deactivateLightingScene(source: EditorDocument, roomId: string): EditorDocument {
  const doc = upgradeLightingDocument(source);
  doc.lightingScenes = doc.lightingScenes!.map((item) =>
    item.roomId === roomId && item.active ? { ...item, active: false } : item);
  return parseEditorDocument(doc);
}

export function renameLightingScene(source: EditorDocument, id: string, name: string): EditorDocument {
  const doc = upgradeLightingDocument(source);
  const scene = find(doc, id);
  scene.name = assertName(name);
  return parseEditorDocument(doc);
}

/** Campos del ambiente que el usuario ajusta sin volver a capturarlo. */
export type LightingScenePatch = Partial<Pick<LightingScene, 'temperatureK' | 'intensityPct' | 'offLightIds' | 'offStripIds'>>;

export function updateLightingScene(source: EditorDocument, id: string, patch: LightingScenePatch): EditorDocument {
  const doc = upgradeLightingDocument(source);
  const scene = find(doc, id);
  Object.assign(scene, patch, {
    ...(patch.offLightIds ? { offLightIds: [...new Set(patch.offLightIds)] } : {}),
    ...(patch.offStripIds ? { offStripIds: [...new Set(patch.offStripIds)] } : {}),
    ...(patch.intensityPct !== undefined ? { intensityPct: Math.round(patch.intensityPct) } : {}),
  });
  return parseEditorDocument(doc);
}

/** Apaga o enciende una luz dentro de la escena, sin tocar su valor nominal. */
export function setLightingSceneLight(source: EditorDocument, id: string, lightId: string, on: boolean): EditorDocument {
  const scene = find(source, id);
  return updateLightingScene(source, id, {
    offLightIds: on ? scene.offLightIds.filter((item) => item !== lightId) : [...scene.offLightIds, lightId],
  });
}

/** Ídem con una tira LED de la estancia. */
export function setLightingSceneStrip(source: EditorDocument, id: string, stripId: string, on: boolean): EditorDocument {
  const scene = find(source, id);
  return updateLightingScene(source, id, {
    offStripIds: on ? scene.offStripIds.filter((item) => item !== stripId) : [...scene.offStripIds, stripId],
  });
}

export function removeLightingScene(source: EditorDocument, id: string): EditorDocument {
  const doc = parseEditorDocument(source);
  doc.lightingScenes = doc.lightingScenes?.filter((item) => item.id !== id);
  return parseEditorDocument(doc);
}
