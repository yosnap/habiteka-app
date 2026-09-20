'use client';
import { AnchoredEditorPanel } from './anchored-editor-panel';
import { useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { X } from 'lucide-react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { EditorDocument, Luminaire } from '@/lib/editor-document/schema';
import { addLuminaire, applyLightingProposal, removeCeiling, removeLuminaire, setRoomCeiling, updateLuminaire } from '@/lib/editor-document/ceiling-commands';
import { ceilingSurfaces, ceilingWarnings, eligibleCeilingRooms, insideRoom } from '@/lib/editor-document/ceiling-geometry';
import { proposeLighting } from '@/lib/editor-document/lighting-proposal';
import { MeterField, NumberField } from './property-number-field';
import styles from './ceiling-lighting.module.css';

const kinds: Record<Luminaire['kind'], string> = { pendant: 'Colgante', flush: 'Plafón', recessed: 'Foco empotrado' };
type LightDraft = Omit<Luminaire, 'id'>;

function LightFields({ light, update }: { light: LightDraft; update: (patch: Partial<LightDraft>) => boolean | void }) {
  return <div className={styles.fields}>
    <label>Tipo<select value={light.kind} onChange={(e) => update({ kind: e.target.value as Luminaire['kind'], dropMm: 0 })}>
      {Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    <label>Acabado<input aria-label="Acabado de luminaria" type="color" value={light.color} onChange={(e) => update({ color: e.target.value })} /></label>
    <MeterField label="Posición X" valueMm={light.x} change={(x) => update({ x })} />
    <MeterField label="Posición Y" valueMm={light.y} change={(y) => update({ y })} />
    <NumberField label="Caída desde techo (cm)" value={light.dropMm / 10} change={(value) => update({ dropMm: value * 10 })} />
    <NumberField label="Temperatura (K)" value={light.temperatureK} step={100} change={(temperatureK) => update({ temperatureK })} />
    <NumberField label="Flujo luminoso (lm)" value={light.lumens} step={100} change={(lumens) => update({ lumens })} />
    <label className={styles.check}><input type="checkbox" checked={light.enabled} onChange={(e) => update({ enabled: e.target.checked })} /> Encendida</label>
  </div>;
}

export function CeilingLightingPanel({ store, onClose }: { store: EditorStore; onClose: () => void }) {
  const state = useStore(store), doc = state.document;
  const geometry = useMemo(() => {
    try { return { rooms: eligibleCeilingRooms(doc), surfaces: ceilingSurfaces(doc), error: null }; }
    catch { return { rooms: [], surfaces: [], error: 'Revisa el cierre de las habitaciones para editar sus techos.' }; }
  }, [doc]);
  const rooms = geometry.rooms;
  const warnings = useMemo(() => ceilingWarnings(doc), [doc]);
  const [roomId, setRoomId] = useState('');
  const [style, setStyle] = useState('moderno');
  const [proposal, setProposal] = useState<ReturnType<typeof proposeLighting> | null>(null);
  const selectedLight = doc.luminaires?.find((light) => state.selection.includes(light.id));
  const selectedCeiling = doc.ceilings?.find((ceiling) => ceiling.id === selectedLight?.ceilingId || state.selection.includes(ceiling.id));
  const activeRoom = rooms.find((room) => room.id === (selectedCeiling?.roomId ?? roomId)) ?? rooms[0];
  const ceiling = doc.ceilings?.find((item) => item.roomId === activeRoom?.id);
  const surface = geometry.surfaces.find((item) => item.ceiling.id === ceiling?.id);
  const lights = doc.luminaires?.filter((light) => light.ceilingId === ceiling?.id) ?? [];
  const run = (operation: (document: EditorDocument) => EditorDocument) => {
    if (store.getState().readOnly) return false;
    try { store.getState().apply(operation(store.getState().document)); return true; }
    catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo editar la iluminación'); return false; }
  };
  const visibleProposal = proposal?.ceilingId === ceiling?.id ? proposal : null;
  return <AnchoredEditorPanel store={store} className={styles.panel} label="Techo y luces">
    <div className={styles.heading}><h2>Techo y luces</h2><button type="button" aria-label="Cerrar techo y luces" onClick={onClose}><X size={20} /></button></div>
    <p>El techo transparente permite trabajar dentro. El render conserva su acabado real.</p>
    <label>Visualización del techo<select value={state.ceilingView} onChange={(e) => state.setCeilingView(e.target.value as typeof state.ceilingView)}>
      <option value="hidden">Oculto</option><option value="transparent">Transparente al editar</option><option value="solid">Sólido</option>
    </select></label>
    {!rooms.length ? <p>{geometry.error ?? 'Cierra una estancia interior para añadir un techo. Los patios y terrazas abiertos quedan fuera.'}</p> : <>
      <label>Estancia<select value={activeRoom?.id ?? ''} onChange={(e) => { setRoomId(e.target.value); state.select([]); setProposal(null); }}>
        {rooms.map((room, index) => <option key={room.id} value={room.id}>{doc.labels.find((label) => insideRoom(label, room.boundary))?.text ?? `Estancia ${index + 1}`} · {(room.areaMm2 / 1e6).toFixed(1)} m²</option>)}
      </select></label>
      <fieldset disabled={state.readOnly}>
        {!ceiling ? <button className={styles.primary} type="button" onClick={() => activeRoom && run((d) => setRoomCeiling(d, activeRoom.id, {}))}>Añadir techo a esta estancia</button> : <>
          <div className={styles.fields}>
            <label>Tipo de techo<select value={ceiling.kind} onChange={(e) => run((d) => setRoomCeiling(d, ceiling.roomId, { kind: e.target.value as 'plain' | 'suspended' }))}>
              <option value="plain">Techo plano</option><option value="suspended">Falso techo</option>
            </select></label>
            <label>Acabado<input type="color" aria-label="Acabado del techo" value={ceiling.color} onChange={(e) => run((d) => setRoomCeiling(d, ceiling.roomId, { color: e.target.value }))} /></label>
            {ceiling.kind === 'suspended' && <NumberField label="Descenso del techo (cm)" value={ceiling.dropMm / 10} change={(value) => run((d) => setRoomCeiling(d, ceiling.roomId, { dropMm: value * 10 }))} />}
          </div>
          {surface && <p>Altura del techo: {(surface.heightMm / 1000).toFixed(2)} m</p>}
          <h3>Añadir luminaria</h3><div className={styles.buttons}>
            {(Object.entries(kinds) as [Luminaire['kind'], string][]).map(([kind, label]) => <button type="button" key={kind} disabled={kind === 'recessed' && (ceiling.kind !== 'suspended' || ceiling.dropMm < 80)} title={kind === 'recessed' ? 'Requiere falso techo con al menos 8 cm de descenso' : undefined} onClick={() => run((d) => addLuminaire(d, ceiling.id, kind))}>{label}</button>)}
          </div>
          <p>Arrastra los símbolos en 2D o ajusta sus coordenadas.</p>
          {lights.map((light, index) => <details className={styles.light} key={light.id} open={selectedLight?.id === light.id || undefined}>
            <summary>{kinds[light.kind]} {index + 1} · {light.enabled ? 'Encendida' : 'Apagada'}</summary>
            <LightFields light={light} update={(patch) => run((d) => updateLuminaire(d, light.id, patch))} />
            <button type="button" className={styles.danger} onClick={() => run((d) => removeLuminaire(d, light.id))}>Eliminar luminaria</button>
          </details>)}
          <div className={styles.proposal}>
            <h3>Proponer iluminación</h3><p>Distribución local según geometría y estilo, sin consumir créditos IA. Revisa la posición y la altura antes de incorporarla.</p>
            <label>Estilo<select value={style} onChange={(e) => { setStyle(e.target.value); setProposal(null); }}><option value="moderno">Moderno</option><option value="mediterraneo">Mediterráneo</option></select></label>
            <button type="button" onClick={() => {
              try { setProposal(proposeLighting(store.getState().document, ceiling.id, style)); }
              catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo proponer iluminación'); }
            }}>Preparar propuesta</button>
            {visibleProposal && <div aria-label="Revisión de propuesta">
              <p>{visibleProposal.lights.length} luminarias nuevas. Se conservarán las {lights.length} existentes.</p>
              {visibleProposal.warnings.map((warning) => <p key={warning} role="status">{warning}</p>)}
              {visibleProposal.lights.map((light, index) => <details className={styles.light} key={index}>
                <summary>Propuesta {index + 1} · {kinds[light.kind]}</summary>
                <LightFields light={light} update={(patch) => setProposal({ ...visibleProposal, lights: visibleProposal.lights.map((item, i) => i === index ? { ...item, ...patch } : item) })} />
                <button type="button" onClick={() => setProposal({ ...visibleProposal, lights: visibleProposal.lights.filter((_, i) => i !== index) })}>Descartar esta luminaria</button>
              </details>)}
              <div className={styles.buttons}><button className={styles.primary} type="button" disabled={!visibleProposal.lights.length} onClick={() => {
                if (run((d) => applyLightingProposal(d, visibleProposal))) setProposal(null);
              }}>Añadir propuesta al plano</button><button type="button" onClick={() => setProposal(null)}>Cancelar propuesta</button></div>
            </div>}
          </div>
          <button className={styles.danger} type="button" onClick={() => { if (run((d) => removeCeiling(d, ceiling.id))) setProposal(null); }}>
            {lights.length ? `Retirar techo y sus ${lights.length} luminarias` : 'Retirar techo'}
          </button>
        </>}
      </fieldset>
    </>}
    {doc.ceilings?.filter((item) => !rooms.some((room) => room.id === item.roomId)).map((item) =>
      <fieldset key={item.id} disabled={state.readOnly}><p>Techo sin estancia reconocida. Conservamos sus luces para revisión.</p>
        <button className={styles.danger} type="button" onClick={() => run((d) => removeCeiling(d, item.id))}>Retirar techo sin estancia y sus luminarias</button>
      </fieldset>)}
    {!!warnings.length && <aside aria-label="Avisos de techo e iluminación"><h3>Revisar</h3>{warnings.map((warning) => <p key={warning}>{warning}</p>)}</aside>}
    {state.readOnly && <p>Documento en modo de solo lectura.</p>}
  </AnchoredEditorPanel>;
}
