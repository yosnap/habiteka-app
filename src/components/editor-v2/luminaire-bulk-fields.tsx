'use client';
import type { Luminaire } from '@/lib/editor-document/schema';
import { NumberField } from './property-number-field';
import styles from './ceiling-lighting.module.css';
import { ModernSelect } from '@/components/ui/modern-select';
import { luminaireKindPatch } from '@/lib/editor-document/ceiling-commands';
import { InlineConfirmButton } from '@/components/ui/inline-confirm-button';

export const LUMINAIRE_KINDS: Record<Luminaire['kind'], string> = { pendant: 'Colgante', flush: 'Plafón', recessed: 'Foco empotrado', spot: 'Foco orientable' };
export const LUMINAIRE_MOUNTS: Record<NonNullable<Luminaire['mount']>, string> = { recessed: 'Empotrado', surface: 'En superficie' };
type BulkPatch = Partial<Omit<Luminaire, 'id' | 'ceilingId' | 'x' | 'y'>>;

/** Campos exclusivos del foco orientable, compartidos por el panel y la edición en bloque. */
export function SpotFields({ light, update, label = (text) => text }: {
  light: Pick<Luminaire, 'mount' | 'tiltDeg' | 'azimuthDeg'>;
  update: (patch: BulkPatch) => boolean | void;
  label?: (text: string, key: keyof Luminaire) => string;
}) {
  return <>
    <label>{label('Montaje', 'mount')}<ModernSelect value={light.mount ?? 'surface'} onChange={(e) => update({ mount: e.target.value as Luminaire['mount'] })}>
      {Object.entries(LUMINAIRE_MOUNTS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
    </ModernSelect></label>
    <NumberField label={label('Inclinación (°)', 'tiltDeg')} value={light.tiltDeg ?? 0} change={(tiltDeg) => update({ tiltDeg })} />
    <NumberField label={label('Giro (°)', 'azimuthDeg')} value={light.azimuthDeg ?? 0} change={(azimuthDeg) => update({ azimuthDeg })} />
  </>;
}

/** Valor común de las luces, o `null` si difieren (se enseña «varios»). */
function common<K extends keyof Luminaire>(lights: readonly Luminaire[], key: K): Luminaire[K] | null {
  const first = lights[0]?.[key];
  return lights.every((light) => light[key] === first) ? (first ?? null) : null;
}

/**
 * Edición en bloque: cada cambio se aplica a TODAS las luces seleccionadas. Si
 * difieren, el campo avisa con «varios» y muestra el valor de la primera.
 */
export function LuminaireBulkFields({ lights, update, remove, clear, readOnly }: {
  lights: readonly Luminaire[];
  update: (patch: BulkPatch) => boolean | void;
  remove: () => void;
  clear: () => void;
  readOnly: boolean;
}) {
  const first = lights[0]!;
  const kind = common(lights, 'kind'), color = common(lights, 'color'), enabled = common(lights, 'enabled');
  const label = (text: string, key: keyof Luminaire) => common(lights, key) === null ? `${text} · varios` : text;
  return <fieldset disabled={readOnly} aria-label="Edición en bloque de luminarias">
    <h3>{lights.length} luces seleccionadas</h3>
    <p>Cada cambio se aplica a todas a la vez. Mayús+clic en el plano suma o quita luces.</p>
    <div className={styles.fields}>
      <label>{label('Tipo', 'kind')}<ModernSelect value={kind ?? ''} onChange={(e) => update(luminaireKindPatch(e.target.value as Luminaire['kind']))}>
        {kind === null && <option value="" disabled>Varios</option>}
        {Object.entries(LUMINAIRE_KINDS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </ModernSelect></label>
      <label>{label('Acabado', 'color')}<input aria-label="Acabado de las luminarias" type="color" value={color ?? first.color} onChange={(e) => update({ color: e.target.value })} /></label>
      <NumberField label={label('Caída desde techo (cm)', 'dropMm')} value={first.dropMm / 10} change={(value) => update({ dropMm: value * 10 })} />
      <NumberField label={label('Temperatura (K)', 'temperatureK')} value={first.temperatureK} step={100} change={(temperatureK) => update({ temperatureK })} />
      <NumberField label={label('Flujo luminoso (lm)', 'lumens')} value={first.lumens} step={100} change={(lumens) => update({ lumens })} />
      {kind === 'spot' && <SpotFields light={first} update={update} label={label} />}
    </div>
    <div className={styles.buttons}>
      <button type="button" aria-pressed={enabled === true} onClick={() => update({ enabled: true })}>Encender todas</button>
      <button type="button" aria-pressed={enabled === false} onClick={() => update({ enabled: false })}>Apagar todas</button>
    </div>
    <div className={styles.buttons}>
      <button type="button" onClick={clear}>Quitar selección</button>
      <InlineConfirmButton className={styles.danger} onConfirm={remove}
        label={`Eliminar ${lights.length} luces`}
        question={`¿Eliminar ${lights.length} luces?`} />
    </div>
  </fieldset>;
}
