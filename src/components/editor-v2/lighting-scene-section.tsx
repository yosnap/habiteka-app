'use client';
import { useState } from 'react';
import type { EditorDocument, LightStrip, Luminaire } from '@/lib/editor-document/schema';
import {
  applyLightingScene,
  deactivateLightingScene,
  removeLightingScene,
  renameLightingScene,
  saveLightingScene,
  setLightingSceneLight,
  setLightingSceneStrip,
  updateLightingScene,
} from '@/lib/editor-document/lighting-scene-commands';
import { activeSceneForRoom, scenesForRoom } from '@/lib/editor-document/lighting-scene';
import { MAX_SCENE_NAME_LENGTH, MAX_SCENES_PER_ROOM } from '@/lib/editor-document/lighting-scene-validation';
import { STRIP_KIND_LABELS } from '@/lib/editor-document/light-strip-types';
import { LUMINAIRE_KINDS } from './luminaire-bulk-fields';
import { NumberField } from './property-number-field';
import { InlineRenameField } from './inline-rename-field';
import { InlineConfirmButton } from '@/components/ui/inline-confirm-button';
import styles from './ceiling-lighting.module.css';

/**
 * Escenas de una estancia. Una escena NO cambia los valores de cada luminaria:
 * es una capa que se aplica encima al resolver, así que desactivarla devuelve
 * el ambiente nominal tal cual estaba.
 *
 * El estado local es solo el nombre en edición; todo lo demás se deriva del
 * documento y se reinicia con la `key` de la estancia en el panel.
 */
export function LightingSceneSection({ doc, roomId, lights, strips, readOnly, run }: {
  doc: EditorDocument;
  roomId: string;
  /** Luminarias de la estancia, para elegir cuáles apaga la escena. */
  lights: readonly Luminaire[];
  /** Tiras LED de la estancia, con el mismo fin. */
  strips: readonly LightStrip[];
  readOnly: boolean;
  run: (operation: (document: EditorDocument) => EditorDocument) => boolean;
}) {
  const scenes = scenesForRoom(doc, roomId);
  const active = activeSceneForRoom(doc, roomId);
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const full = scenes.length >= MAX_SCENES_PER_ROOM;
  return <div className={styles.proposal}>
    <h3>Escenas de esta estancia</h3>
    <p>Una escena guarda el ambiente (temperatura, intensidad y qué está encendido) y se aplica de golpe. No cambia los lúmenes ni la temperatura de cada luminaria: al desactivarla vuelven los valores del proyecto.</p>
    <label>Nombre de la escena nueva
      <input value={name} maxLength={MAX_SCENE_NAME_LENGTH} placeholder="Cena, Lectura, Limpieza…"
        onChange={(event) => setName(event.target.value)} />
    </label>
    <button type="button" className={styles.primary} disabled={readOnly || full || !name.trim()}
      title={full ? `Esta estancia ya tiene ${MAX_SCENES_PER_ROOM} escenas` : undefined}
      onClick={() => { if (run((document) => saveLightingScene(document, roomId, name))) setName(''); }}>
      Guardar el ambiente actual como escena
    </button>
    {active && <button type="button" onClick={() => run((document) => deactivateLightingScene(document, roomId))}>
      Volver al ambiente del proyecto (desactivar «{active.name}»)
    </button>}
    {!scenes.length && <p>Sin escenas guardadas.</p>}
    {scenes.map((scene) => <details className={styles.light} key={scene.id} open={scene.active || undefined}>
      <summary>{scene.name} · {scene.active ? 'Activa' : 'Guardada'}</summary>
      <p>{scene.temperatureK} K · {scene.intensityPct} % de intensidad · {scene.offLightIds.length + scene.offStripIds.length} apagadas</p>
      <div className={styles.buttons}>
        {scene.active
          ? <button type="button" onClick={() => run((document) => deactivateLightingScene(document, roomId))}>Desactivar</button>
          : <button type="button" className={styles.primary} onClick={() => run((document) => applyLightingScene(document, scene.id))}>Aplicar escena</button>}
        {renaming === scene.id
          ? <InlineRenameField label="Nombre de la escena" value={scene.name} maxLength={MAX_SCENE_NAME_LENGTH}
              disabled={readOnly} onCancel={() => setRenaming(null)}
              onSubmit={(next) => { if (run((document) => renameLightingScene(document, scene.id, next))) setRenaming(null); }} />
          : <button type="button" onClick={() => setRenaming(scene.id)}>Renombrar</button>}
        <InlineConfirmButton label="Eliminar escena" question="¿Eliminar esta escena?" className={styles.danger}
          disabled={readOnly} onConfirm={() => run((document) => removeLightingScene(document, scene.id))} />
      </div>
      <div className={styles.fields}>
        <NumberField label="Temperatura (K)" value={scene.temperatureK} step={100}
          change={(temperatureK) => run((document) => updateLightingScene(document, scene.id, { temperatureK }))} />
        <NumberField label="Intensidad (%)" value={scene.intensityPct} step={5}
          change={(intensityPct) => run((document) => updateLightingScene(document, scene.id, { intensityPct }))} />
      </div>
      {lights.map((light, index) => <label className={styles.check} key={light.id}>
        <input type="checkbox" checked={!scene.offLightIds.includes(light.id)}
          onChange={(event) => run((document) => setLightingSceneLight(document, scene.id, light.id, event.target.checked))} />
        {LUMINAIRE_KINDS[light.kind]} {index + 1}{light.enabled ? '' : ' · apagada en el proyecto'}
      </label>)}
      {strips.map((strip, index) => <label className={styles.check} key={strip.id}>
        <input type="checkbox" checked={!scene.offStripIds.includes(strip.id)}
          onChange={(event) => run((document) => setLightingSceneStrip(document, scene.id, strip.id, event.target.checked))} />
        {STRIP_KIND_LABELS[strip.kind]} {index + 1}{strip.enabled ? '' : ' · apagada en el proyecto'}
      </label>)}
    </details>)}
  </div>;
}
