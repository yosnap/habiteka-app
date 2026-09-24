'use client';
import type { LightStrip } from '@/lib/editor-document/schema';
import { NumberField } from './property-number-field';
import styles from './ceiling-lighting.module.css';
import type { LightStripPatch } from '@/lib/editor-document/light-strip-commands';

/** Campos de una tira LED. El recorrido se retoca en el plano, no aquí. */
export function LightStripFields({ strip, update }: {
  strip: LightStrip; update: (patch: LightStripPatch) => boolean | void;
}) {
  return <div className={styles.fields}>
    <label>Color<input aria-label="Color de la tira LED" type="color" value={strip.color} onChange={(event) => update({ color: event.target.value })} /></label>
    <NumberField label="Cota sobre el suelo (cm)" value={strip.elevationMm / 10} change={(value) => update({ elevationMm: Math.round(value * 10) })} />
    <NumberField label="Temperatura (K)" value={strip.temperatureK} step={100} change={(temperatureK) => update({ temperatureK })} />
    <NumberField label="Flujo por metro (lm/m)" value={strip.lumensPerMeter} step={50} change={(lumensPerMeter) => update({ lumensPerMeter })} />
    <label className={styles.check}><input type="checkbox" checked={strip.enabled} onChange={(event) => update({ enabled: event.target.checked })} /> Encendida</label>
  </div>;
}

/** Valor común de las tiras, o null cuando difieren (se enseña «varios»). */
function common<K extends keyof LightStrip>(strips: readonly LightStrip[], key: K): LightStrip[K] | null {
  const first = strips[0]?.[key];
  return strips.every((strip) => strip[key] === first) ? (first ?? null) : null;
}

/** Edición en bloque: cada cambio se aplica a todas las tiras seleccionadas. */
export function LightStripBulkFields({ strips, update, remove, clear, readOnly }: {
  strips: readonly LightStrip[];
  update: (patch: LightStripPatch) => boolean | void;
  remove: () => void;
  clear: () => void;
  readOnly: boolean;
}) {
  const first = strips[0]!;
  const enabled = common(strips, 'enabled'), color = common(strips, 'color');
  const label = (text: string, key: keyof LightStrip) => (common(strips, key) === null ? `${text} · varios` : text);
  return <fieldset disabled={readOnly} aria-label="Edición en bloque de tiras LED">
    <h3>{strips.length} tiras seleccionadas</h3>
    <p>Cada cambio se aplica a todas a la vez. Mayús+clic en el plano suma o quita tiras.</p>
    <div className={styles.fields}>
      <label>{label('Color', 'color')}<input aria-label="Color de las tiras LED" type="color" value={color ?? first.color} onChange={(event) => update({ color: event.target.value })} /></label>
      <NumberField label={label('Cota sobre el suelo (cm)', 'elevationMm')} value={first.elevationMm / 10} change={(value) => update({ elevationMm: Math.round(value * 10) })} />
      <NumberField label={label('Temperatura (K)', 'temperatureK')} value={first.temperatureK} step={100} change={(temperatureK) => update({ temperatureK })} />
      <NumberField label={label('Flujo por metro (lm/m)', 'lumensPerMeter')} value={first.lumensPerMeter} step={50} change={(lumensPerMeter) => update({ lumensPerMeter })} />
    </div>
    <div className={styles.buttons}>
      <button type="button" aria-pressed={enabled === true} onClick={() => update({ enabled: true })}>Encender todas</button>
      <button type="button" aria-pressed={enabled === false} onClick={() => update({ enabled: false })}>Apagar todas</button>
    </div>
    <div className={styles.buttons}>
      <button type="button" onClick={clear}>Quitar selección</button>
      <button type="button" className={styles.danger} onClick={remove}>Eliminar {strips.length} tiras</button>
    </div>
  </fieldset>;
}
