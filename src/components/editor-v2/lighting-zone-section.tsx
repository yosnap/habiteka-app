'use client';
import { useState } from 'react';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { removeLightZone, renameLightZone } from '@/lib/editor-document/light-zone-commands';
import { MAX_LIGHT_ZONES, MAX_ZONE_NAME_LENGTH } from '@/lib/editor-document/light-zone-validation';
import { lightsInZone, stripsInZone } from '@/lib/editor-document/lighting-zone';
import { REGION_MODES, REGION_MODE_LABELS } from '@/lib/editor-document/render-region-draw';
import { LIGHT_ZONE_MODE_HINTS, type LightZoneMode } from '@/canvas/editor-v2/light-zone-draw';
import { ModernSelect } from '@/components/ui/modern-select';
import { InlineRenameField } from './inline-rename-field';
import { InlineConfirmButton } from '@/components/ui/inline-confirm-button';
import styles from './ceiling-lighting.module.css';

/**
 * Zonas de luces guardadas en el proyecto. El dibujo ocurre en el PLANO grande
 * con la herramienta `light-zone` (imanes, cota en vivo y Esc incluidos); aquí
 * solo se elige el modo, se lanza la herramienta y se gestiona la lista.
 *
 * La zona activa es estado de sesión (vive en el store, no en el documento):
 * cambiarla no ensucia el plano ni cuenta como edición.
 */
export function LightingZoneSection({ doc, activeId, readOnly, drawing, run, onActivate, onSelect, onDraw, onCancelDraw }: {
  doc: EditorDocument;
  /** Zona activa, o null si se trabaja sobre todo el plano. */
  activeId: string | null;
  readOnly: boolean;
  /** Hay un trazo de zona en curso en el plano. */
  drawing: boolean;
  run: (operation: (document: EditorDocument) => EditorDocument) => boolean;
  onActivate: (id: string | null) => void;
  /** Lleva la selección del lienzo a las luces y tiras de la zona. */
  onSelect: (ids: string[]) => void;
  /** Lanza la herramienta del plano; con `zoneId` redibuja esa zona. */
  onDraw: (mode: LightZoneMode, zoneId: string | null) => void;
  onCancelDraw: () => void;
}) {
  const zones = doc.lightZones ?? [];
  const active = zones.find((zone) => zone.id === activeId) ?? null;
  const [mode, setMode] = useState<LightZoneMode>('room');
  const [renaming, setRenaming] = useState(false);
  const full = zones.length >= MAX_LIGHT_ZONES;
  const lights = active ? lightsInZone(doc, active.polygonsMm) : [];
  const strips = active ? stripsInZone(doc, active.polygonsMm) : [];

  return <div className={styles.proposal}>
    <h3>Zonas de luces</h3>
    <p>Una zona guardada acota con qué luces se trabaja: selecciónalas de golpe para editarlas en bloque. Se dibuja sobre el plano y puede tener varias partes sueltas, aunque no se toquen.</p>
    <label>Zona activa
      <ModernSelect value={activeId ?? ''} onChange={(event) => { setRenaming(false); onActivate(event.target.value || null); }}>
        <option value="">Todo el plano</option>
        {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
      </ModernSelect>
    </label>
    {active && <>
      <p>{lights.length} luminarias y {strips.length} tiras dentro de «{active.name}» ({active.polygonsMm.length} {active.polygonsMm.length === 1 ? 'parte' : 'partes'}).</p>
      <div className={styles.buttons}>
        <button type="button" className={styles.primary} disabled={!lights.length && !strips.length}
          onClick={() => onSelect([...lights.map((light) => light.id), ...strips.map((strip) => strip.id)])}>
          Seleccionar las luces de la zona
        </button>
        {renaming
          ? <InlineRenameField label="Nombre de la zona" value={active.name} maxLength={MAX_ZONE_NAME_LENGTH}
              disabled={readOnly} onCancel={() => setRenaming(false)}
              onSubmit={(next) => { if (run((document) => renameLightZone(document, active.id, next))) setRenaming(false); }} />
          : <button type="button" disabled={readOnly} onClick={() => setRenaming(true)}>Renombrar zona</button>}
        <button type="button" disabled={readOnly}
          onClick={() => { setRenaming(false); onDraw(mode, active.id); }}>Redibujar en el plano</button>
        <InlineConfirmButton label="Eliminar zona" question="¿Eliminar esta zona? Las luces no se tocan."
          className={styles.danger} disabled={readOnly}
          onConfirm={() => { if (run((document) => removeLightZone(document, active.id))) onActivate(null); }} />
      </div>
    </>}
    {!zones.length && <p>Sin zonas guardadas.</p>}
    <label>Modo de marcado
      <ModernSelect value={mode} disabled={readOnly || drawing} onChange={(event) => setMode(event.target.value as LightZoneMode)}>
        {REGION_MODES.map((value) => <option key={value} value={value}>{REGION_MODE_LABELS[value]}</option>)}
      </ModernSelect>
    </label>
    <p>{LIGHT_ZONE_MODE_HINTS[mode]}</p>
    {drawing
      ? <button type="button" onClick={onCancelDraw}>Cancelar el trazo del plano</button>
      : <button type="button" disabled={readOnly || full}
          title={full ? `El proyecto ya tiene ${MAX_LIGHT_ZONES} zonas de luces` : undefined}
          onClick={() => { setRenaming(false); onDraw(mode, null); }}>
          {full ? `Máximo de ${MAX_LIGHT_ZONES} zonas alcanzado` : 'Dibujar zona en el plano'}
        </button>}
  </div>;
}

export default LightingZoneSection;
