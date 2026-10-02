'use client';
import { useState } from 'react';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { KITCHEN_SLOT_DEFAULTS, KITCHEN_SLOT_KINDS, type KitchenComposition, type KitchenRun, type KitchenSlot, type KitchenSlotKind, type KitchenUppers } from '@/lib/editor-document/kitchen-run-types';
import { addKitchenSlot, putKitchenSlot, removeKitchenSlot, splitKitchenRun, updateKitchenRun } from '@/lib/editor-document/kitchen-run-commands';
import { addUnderCabinetStrip } from '@/lib/editor-document/light-strip-commands';
import { MeterField } from './property-number-field';
import { SurfaceMaterialPicker } from './surface-material-picker';
import styles from './editor.module.css';
import { ModernSelect } from '@/components/ui/modern-select';

interface Props { doc: EditorDocument; item: KitchenRun; selectedSlotId?: string; edit: (operation: (doc: EditorDocument) => EditorDocument) => boolean }
/** Composición del mueble de cocina: bajos, encimera, altos y aparatos encajados en el tramo. */
export function KitchenFields({ doc, item, selectedSlotId, edit }: Props) {
  const k = item.kitchen, [kind, setKind] = useState<KitchenSlotKind>('fregadero');
  const strip = (doc.lightStrips ?? []).find((item_) => item_.kitchenRunId === item.id);
  const change = (patch: Partial<KitchenComposition>) => edit((doc) => updateKitchenRun(doc, item.id, { kitchen: { ...k, ...patch } }));
  const uppers = (patch: Partial<KitchenUppers>) => k.uppers && change({ uppers: { ...k.uppers, ...patch } });
  const slot = (s: KitchenSlot, patch: Partial<KitchenSlot>) => edit((doc) => putKitchenSlot(doc, item.id, { ...s, ...patch }));
  const toggleUppers = (enabled: boolean) => {
    const rest: KitchenComposition = { ...k }; delete rest.uppers;
    return edit((doc) => updateKitchenRun(doc, item.id, { kitchen: enabled
      ? { ...rest, uppers: { bottomMm: item.heightMm + 550, heightMm: 700, depthMm: Math.min(350, item.depthMm), color: item.color } } : rest }));
  };
  return <section aria-label="Composición de la cocina">
    <h3>Módulos bajos</h3>
    <div className={styles.fields}>
      <MeterField label="Altura del zócalo" valueMm={k.plinthHeightMm} change={(plinthHeightMm) => change({ plinthHeightMm })} />
      <MeterField label="Grosor de encimera" valueMm={k.worktopThicknessMm} change={(worktopThicknessMm) => change({ worktopThicknessMm })} />
      <MeterField label="Ancho de módulo" valueMm={k.moduleWidthMm} change={(moduleWidthMm) => change({ moduleWidthMm })} />
    </div>
    <label className={styles.field}>Color de frentes<input type="color" value={item.color} onChange={(e) => edit((doc) => updateKitchenRun(doc, item.id, { color: e.target.value }))} /></label>
    <label className={styles.field}>Color de encimera<input type="color" value={k.worktopColor} onChange={(e) => change({ worktopColor: e.target.value })} /></label>
    <label className={styles.field}>Color del zócalo<input type="color" value={k.plinthColor} onChange={(e) => change({ plinthColor: e.target.value })} /></label>
    <SurfaceMaterialPicker label="Material de frentes" value={k.baseMaterialId} onChange={(baseMaterialId) => change({ baseMaterialId })} />
    <SurfaceMaterialPicker label="Material de encimera" value={k.worktopMaterialId} onChange={(worktopMaterialId) => change({ worktopMaterialId })} />
    <button type="button" onClick={() => edit((doc) => splitKitchenRun(doc, item.id, item.widthMm / 2))}>Dividir tramo al 50%</button>
    <h3>Módulos altos</h3>
    <label className={styles.field}>Módulos altos<ModernSelect aria-label="Módulos altos" value={k.uppers ? 'yes' : 'no'} onChange={(e) => toggleUppers(e.target.value === 'yes')}>
      <option value="no">Sin módulos altos</option><option value="yes">Con módulos altos</option>
    </ModernSelect></label>
    {k.uppers && <>
      <div className={styles.fields}>
        <MeterField label="Cota inferior de los altos" valueMm={k.uppers.bottomMm} change={(bottomMm) => uppers({ bottomMm })} />
        <MeterField label="Altura de los altos" valueMm={k.uppers.heightMm} change={(heightMm) => uppers({ heightMm })} />
        <MeterField label="Fondo de los altos" valueMm={k.uppers.depthMm} change={(depthMm) => uppers({ depthMm })} />
      </div>
      <label className={styles.field}>Color de los altos<input type="color" value={k.uppers.color} onChange={(e) => uppers({ color: e.target.value })} /></label>
      <SurfaceMaterialPicker label="Material de los altos" value={k.uppers.materialId} onChange={(materialId) => uppers({ materialId })} />
    </>}
    <div className={styles.actions}>
      <button type="button" disabled={!k.uppers || !!strip}
        title={!k.uppers ? 'Este tramo no tiene módulos altos bajo los que colgar la tira'
          : strip ? 'Este tramo de cocina ya tiene tira bajo los módulos altos' : undefined}
        onClick={() => edit((d) => addUnderCabinetStrip(d, item.id))}>Tira bajo módulos altos</button>
    </div>
    <p className={styles.hint}>
      {strip ? `La tira ${strip.derived ? 'sigue al mueble' : 'está ajustada a mano'}; se edita en «Techo y luces».`
        : 'Cada tramo lleva su propia tira: los tramos en L no se fusionan.'}
    </p>
    <h3>Aparatos</h3>
    <p className={styles.hint}>El aparato se encaja en el tramo y su centro se mide desde el inicio. Arrástralo en el plano para moverlo.</p>
    <div className={styles.actions}>
      <ModernSelect aria-label="Aparato a añadir" value={kind} onChange={(e) => setKind(e.target.value as KitchenSlotKind)}>
        {KITCHEN_SLOT_KINDS.map((option) => <option key={option} value={option}>{KITCHEN_SLOT_DEFAULTS[option].label}</option>)}
      </ModernSelect>
      <button type="button" onClick={() => edit((doc) => addKitchenSlot(doc, item.id, kind))}>Añadir aparato</button>
    </div>
    {k.slots.map((s, index) => <fieldset key={s.id} aria-label={`${KITCHEN_SLOT_DEFAULTS[s.kind].label} ${index + 1}`}
      style={{ marginTop: 16, padding: 8, border: `1px solid ${s.id === selectedSlotId ? '#087f75' : '#ccd5d1'}` }}>
      <legend>{KITCHEN_SLOT_DEFAULTS[s.kind].label} {index + 1}</legend>
      <label className={styles.field}>Tipo<ModernSelect value={s.kind} onChange={(e) => { const next = e.target.value as KitchenSlotKind; slot(s, { kind: next, widthMm: KITCHEN_SLOT_DEFAULTS[next].widthMm, color: KITCHEN_SLOT_DEFAULTS[next].color }); }}>
        {KITCHEN_SLOT_KINDS.map((option) => <option key={option} value={option}>{KITCHEN_SLOT_DEFAULTS[option].label}</option>)}
      </ModernSelect></label>
      <div className={styles.fields}>
        <MeterField label={`Centro del aparato ${index + 1}`} valueMm={s.positionMm} change={(positionMm) => slot(s, { positionMm })} />
        <MeterField label={`Ancho del aparato ${index + 1}`} valueMm={s.widthMm} change={(widthMm) => slot(s, { widthMm })} />
      </div>
      <label className={styles.field}>Color del aparato<input type="color" value={s.color} onChange={(e) => slot(s, { color: e.target.value })} /></label>
      <button type="button" onClick={() => edit((doc) => removeKitchenSlot(doc, s.id))}>Eliminar aparato</button>
    </fieldset>)}
  </section>;
}
