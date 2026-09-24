'use client';
import { useMemo, useState } from 'react';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { EditorDocument, Luminaire } from '@/lib/editor-document/schema';
import { addLuminaire, applyLightingProposal, ceilingDropMm, luminaireKindPatch, MAX_CEILING_DROP_MM, MIN_CEILING_DROP_MM, removeCeiling, removeLuminaire, removeLuminaires, setRoomCeiling, updateLuminaire, updateLuminaires } from '@/lib/editor-document/ceiling-commands';
import { ceilingSurfaces, ceilingWarnings, eligibleCeilingRooms, insideRoom } from '@/lib/editor-document/ceiling-geometry';
import { proposeLighting } from '@/lib/editor-document/lighting-proposal';
import { MeterField, NumberField } from './property-number-field';
import styles from './ceiling-lighting.module.css';
import { CeilingPlanSection } from './ceiling-plan-section';
import { LUMINAIRE_KINDS as kinds, LuminaireBulkFields, SpotFields } from './luminaire-bulk-fields';
import { ModernSelect } from '@/components/ui/modern-select';
import { CeilingStripSection } from './ceiling-strip-section';
import { LightingSceneSection } from './lighting-scene-section';
import { LightingZoneSection } from './lighting-zone-section';
import { LightStripBulkFields } from './light-strip-fields';
import { removeLightStrips, updateLightStrips } from '@/lib/editor-document/light-strip-commands';
import { stripRoomId } from '@/lib/editor-document/light-strip-geometry';
import { objectCenter } from '@/lib/editor-document/spatial-properties';
type LightDraft = Omit<Luminaire, 'id'>;

function LightFields({ light, update }: { light: LightDraft; update: (patch: Partial<LightDraft>) => boolean | void }) {
  return <div className={styles.fields}>
    <label>Tipo<ModernSelect value={light.kind} onChange={(e) => update(luminaireKindPatch(e.target.value as Luminaire['kind']))}>
      {Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </ModernSelect></label>
    <label>Acabado<input aria-label="Acabado de luminaria" type="color" value={light.color} onChange={(e) => update({ color: e.target.value })} /></label>
    <MeterField label="Posición X" valueMm={light.x} change={(x) => update({ x })} />
    <MeterField label="Posición Y" valueMm={light.y} change={(y) => update({ y })} />
    <NumberField label="Caída desde techo (cm)" value={light.dropMm / 10} change={(value) => update({ dropMm: value * 10 })} />
    <NumberField label="Temperatura (K)" value={light.temperatureK} step={100} change={(temperatureK) => update({ temperatureK })} />
    <NumberField label="Flujo luminoso (lm)" value={light.lumens} step={100} change={(lumens) => update({ lumens })} />
    {light.kind === 'spot' && <SpotFields light={light} update={update} />}
    <label className={styles.check}><input type="checkbox" checked={light.enabled} onChange={(e) => update({ enabled: e.target.checked })} /> Encendida</label>
  </div>;
}

export function CeilingLightingPanel({ store }: { store: EditorStore }) {
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
  const [scope, setScope] = useState<'plan' | 'room'>('plan');
  // Opciones de la propuesta local: acento orientable y foseado perimetral.
  const [accentSpots, setAccentSpots] = useState(false);
  const [cove, setCove] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const selectedLights = doc.luminaires?.filter((light) => state.selection.includes(light.id)) ?? [];
  const selectedLight = selectedLights.length === 1 ? selectedLights[0] : undefined;
  const selectedCeiling = doc.ceilings?.find((ceiling) => ceiling.id === selectedLight?.ceilingId || state.selection.includes(ceiling.id));
  const activeRoom = rooms.find((room) => room.id === (selectedCeiling?.roomId ?? roomId)) ?? rooms[0];
  const ceiling = doc.ceilings?.find((item) => item.roomId === activeRoom?.id);
  const surface = geometry.surfaces.find((item) => item.ceiling.id === ceiling?.id);
  const lights = doc.luminaires?.filter((light) => light.ceilingId === ceiling?.id) ?? [];
  const strips = useMemo(() => activeRoom
    ? (doc.lightStrips ?? []).filter((strip) => stripRoomId(doc, strip) === activeRoom.id) : [], [doc, activeRoom]);
  // Tramos de cocina de la estancia activa: el punto de alta de la tira bajo módulos altos.
  const kitchenRuns = useMemo(() => activeRoom
    ? (doc.kitchenRuns ?? []).filter((item) => insideRoom(objectCenter(item), activeRoom.boundary)) : [], [doc, activeRoom]);
  const selectedStrips = doc.lightStrips?.filter((strip) => state.selection.includes(strip.id)) ?? [];
  const run = (operation: (document: EditorDocument) => EditorDocument) => {
    if (store.getState().readOnly) return false;
    try { store.getState().apply(operation(store.getState().document)); return true; }
    catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo editar la iluminación'); return false; }
  };
  const visibleProposal = proposal?.ceilingId === ceiling?.id ? proposal : null;
  // La zona activa acota la propuesta: la misma que se elige en «Toda la planta».
  const activeZone = doc.lightZones?.find((zone) => zone.id === state.activeLightZoneId) ?? null;
  const proposalOptions = { accentSpots, cove, ...(activeZone ? { zonePolygonsMm: activeZone.polygonsMm } : {}) };
  // Elegir una luz o un techo concreto en el plano lleva a su estancia.
  const shownScope = selectedLight || selectedCeiling ? 'room' : scope;
  const selectLights = (ids: string[]) => { setNotice(null); state.select(ids); };
  return <section className={styles.panel} aria-label="Techo y luces">
    <p>El techo transparente permite trabajar dentro. El render conserva su acabado real.</p>
    <label>Visualización del techo<ModernSelect value={state.ceilingView} onChange={(e) => state.setCeilingView(e.target.value as typeof state.ceilingView)}>
      <option value="hidden">Oculto</option><option value="transparent">Transparente al editar</option><option value="solid">Sólido</option>
    </ModernSelect></label>
    {notice && <p role="status">{notice}</p>}
    {selectedStrips.length > 1 ? <LightStripBulkFields strips={selectedStrips} readOnly={state.readOnly}
      update={(patch) => run((d) => updateLightStrips(d, selectedStrips.map((strip) => strip.id), patch))}
      remove={() => run((d) => removeLightStrips(d, selectedStrips.map((strip) => strip.id)))}
      clear={() => selectLights([])} />
    : selectedLights.length > 1 ? <LuminaireBulkFields lights={selectedLights} readOnly={state.readOnly}
      update={(patch) => run((d) => updateLuminaires(d, selectedLights.map((light) => light.id), patch))}
      remove={() => run((d) => removeLuminaires(d, selectedLights.map((light) => light.id)))}
      clear={() => selectLights([])} />
    : !rooms.length ? <p>{geometry.error ?? 'Cierra una estancia interior para añadir un techo. Los patios y terrazas abiertos quedan fuera.'}</p> : <>
      <div className={styles.buttons} role="group" aria-label="Ámbito">
        <button type="button" aria-pressed={shownScope === 'plan'} className={shownScope === 'plan' ? styles.primary : undefined}
          onClick={() => { setScope('plan'); if (selectedLight || selectedCeiling) state.select([]); }}>Toda la planta</button>
        <button type="button" aria-pressed={shownScope === 'room'} className={shownScope === 'room' ? styles.primary : undefined}
          onClick={() => setScope('room')}>Una estancia</button>
      </div>
      {shownScope === 'plan' ? <><CeilingPlanSection doc={doc} roomCount={rooms.length} readOnly={state.readOnly} run={run}
        zone={doc.lightZones?.find((zone) => zone.id === state.activeLightZoneId) ?? null} onNotice={setNotice} onSelectAll={() => selectLights((doc.luminaires ?? []).map((light) => light.id))} />
        <LightingZoneSection doc={doc} activeId={state.activeLightZoneId} readOnly={state.readOnly} run={run}
          drawing={state.tool === 'light-zone'}
          onDraw={(mode, zoneId) => { setNotice(null); state.beginLightZoneDraw(mode, zoneId); }}
          onCancelDraw={() => state.setTool('select')}
          onActivate={state.setActiveLightZone} onSelect={selectLights} /></> : <>
      <label>Estancia<ModernSelect value={activeRoom?.id ?? ''} onChange={(e) => { setRoomId(e.target.value); state.select([]); setProposal(null); }}>
        {rooms.map((room, index) => <option key={room.id} value={room.id}>{doc.labels.find((label) => insideRoom(label, room.boundary))?.text ?? `Estancia ${index + 1}`} · {(room.areaMm2 / 1e6).toFixed(1)} m²</option>)}
      </ModernSelect></label>
      <fieldset disabled={state.readOnly}>
        {!ceiling ? <button className={styles.primary} type="button" onClick={() => activeRoom && run((d) => setRoomCeiling(d, activeRoom.id, {}))}>Añadir techo a esta estancia</button> : <>
          <div className={styles.fields}>
            <label>Tipo de techo<ModernSelect value={ceiling.kind} onChange={(e) => run((d) => setRoomCeiling(d, ceiling.roomId, { kind: e.target.value as 'plain' | 'suspended' }))}>
              <option value="plain">Techo plano</option><option value="suspended">Falso techo</option>
            </ModernSelect></label>
            <label>Acabado<input type="color" aria-label="Acabado del techo" value={ceiling.color} onChange={(e) => run((d) => setRoomCeiling(d, ceiling.roomId, { color: e.target.value }))} /></label>
            {ceiling.kind === 'suspended' && <NumberField label="Descenso del techo (cm)" value={ceiling.dropMm / 10}
              change={(value) => run((d) => setRoomCeiling(d, ceiling.roomId, { dropMm: ceilingDropMm(value) }))} />}
          </div>
          {ceiling.kind === 'suspended' && <p>El descenso va en centímetros, entre {MIN_CEILING_DROP_MM / 10} y {MAX_CEILING_DROP_MM / 10} cm.</p>}
          {surface && <p>Altura del techo: {(surface.heightMm / 1000).toFixed(2)} m</p>}
          <h3>Añadir luminaria</h3><div className={styles.buttons}>
            {(Object.entries(kinds) as [Luminaire['kind'], string][]).map(([kind, label]) => <button type="button" key={kind} disabled={kind === 'recessed' && (ceiling.kind !== 'suspended' || ceiling.dropMm < 80)} title={kind === 'recessed' ? 'Requiere falso techo con al menos 8 cm de descenso' : undefined} onClick={() => run((d) => addLuminaire(d, ceiling.id, kind))}>{label}</button>)}
          </div>
          <p>Arrastra los símbolos en 2D o ajusta sus coordenadas. Mayús+clic selecciona varias.</p>
          {lights.length > 1 && <button type="button" onClick={() => selectLights(lights.map((light) => light.id))}>Seleccionar las {lights.length} luces de esta estancia</button>}
          {lights.map((light, index) => <details className={styles.light} key={light.id} open={selectedLight?.id === light.id || undefined}>
            <summary>{kinds[light.kind]} {index + 1} · {light.enabled ? 'Encendida' : 'Apagada'}</summary>
            <LightFields light={light} update={(patch) => run((d) => updateLuminaire(d, light.id, patch))} />
            <button type="button" className={styles.danger} onClick={() => run((d) => removeLuminaire(d, light.id))}>Eliminar luminaria</button>
          </details>)}
          {ceiling && <CeilingStripSection doc={doc} ceiling={ceiling} strips={strips} kitchenRuns={kitchenRuns} readOnly={state.readOnly}
            selectedId={selectedStrips.length === 1 ? selectedStrips[0]!.id : undefined}
            run={run} onDraw={() => { setNotice(null); state.setTool('light-strip'); }} />}
          {activeRoom && <LightingSceneSection key={activeRoom.id} doc={doc} roomId={activeRoom.id}
            lights={lights} strips={strips} readOnly={state.readOnly} run={run} />}
          <div className={styles.proposal}>
            <h3>Proponer iluminación</h3><p>Distribución local según geometría y estilo, sin consumir créditos IA. Revisa la posición y la altura antes de incorporarla.</p>
            <label>Estilo<ModernSelect value={style} onChange={(e) => { setStyle(e.target.value); setProposal(null); }}><option value="moderno">Moderno</option><option value="mediterraneo">Mediterráneo</option></ModernSelect></label>
            <label className={styles.check}><input type="checkbox" checked={accentSpots}
              onChange={(e) => { setAccentSpots(e.target.checked); setProposal(null); }} /> Focos orientables de acento</label>
            <label className={styles.check}><input type="checkbox" checked={cove}
              onChange={(e) => { setCove(e.target.checked); setProposal(null); }} /> Foseado perimetral de falso techo</label>
            {activeZone && <p>Acotada a la zona «{activeZone.name}»: fuera de su contorno no se propone ninguna luz.</p>}
            <button type="button" onClick={() => {
              try { setProposal(proposeLighting(store.getState().document, ceiling.id, style, proposalOptions)); }
              catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo proponer iluminación'); }
            }}>Preparar propuesta</button>
            {visibleProposal && <div aria-label="Revisión de propuesta">
              <p>{visibleProposal.lights.length} luminarias nuevas{visibleProposal.cove ? ' y foseado perimetral' : ''}. Se conservarán las {lights.length} existentes.</p>
              {visibleProposal.warnings.map((warning) => <p key={warning} role="status">{warning}</p>)}
              {visibleProposal.lights.map((light, index) => <details className={styles.light} key={index}>
                <summary>Propuesta {index + 1} · {kinds[light.kind]}</summary>
                <LightFields light={light} update={(patch) => setProposal({ ...visibleProposal, lights: visibleProposal.lights.map((item, i) => i === index ? { ...item, ...patch } : item) })} />
                <button type="button" onClick={() => setProposal({ ...visibleProposal, lights: visibleProposal.lights.filter((_, i) => i !== index) })}>Descartar esta luminaria</button>
              </details>)}
              <div className={styles.buttons}><button className={styles.primary} type="button" disabled={!visibleProposal.lights.length && !visibleProposal.cove} onClick={() => {
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
    </>}
    {doc.ceilings?.filter((item) => !rooms.some((room) => room.id === item.roomId)).map((item) =>
      <fieldset key={item.id} disabled={state.readOnly}><p>Techo sin estancia reconocida. Conservamos sus luces para revisión.</p>
        <button className={styles.danger} type="button" onClick={() => run((d) => removeCeiling(d, item.id))}>Retirar techo sin estancia y sus luminarias</button>
      </fieldset>)}
    {!!warnings.length && <aside aria-label="Avisos de techo e iluminación"><h3>Revisar</h3>{warnings.map((warning) => <p key={warning}>{warning}</p>)}</aside>}
    {state.readOnly && <p>Documento en modo de solo lectura.</p>}
  </section>;
}
