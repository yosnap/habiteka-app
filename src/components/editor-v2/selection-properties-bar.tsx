'use client';
import { useStore } from 'zustand';
import { AlignCenterHorizontal, Scissors, SlidersHorizontal, Trash2, X } from 'lucide-react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { deleteEntities, editDocument, newId } from '@/canvas/editor-v2/editing-operations';
import { distance, wallPoints } from '@/lib/editor-document/geometry';
import { applyCommand } from '@/lib/editor-document/commands';
import { assertOpeningClearance } from '@/lib/editor-document/opening-clearance';
import { openingConstruction, wallConstruction } from '@/lib/editor-document/construction-properties';
import { setOpeningConstruction, setWallConstruction, updateStair } from '@/lib/editor-document/construction-commands';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { updateFurniture } from '@/lib/editor-document/spatial-commands';
import { furnitureSpatial } from '@/lib/editor-document/spatial-properties';
import styles from './editor.module.css';
import { defaultWallCurve, setWallCurve } from '@/lib/editor-document/curve-commands';
import { CurvedWallIcon, StraightWallIcon } from './wall-action-icons';

function MeasureField({ label, value, minimum = .01, unit = 'cm', onCommit }: { label: string; value: number; minimum?: number; unit?: string; onCommit: (n: number) => boolean }) {
  return <label className={styles.measureField}><span>{label}</span><div><input key={value} type="number"
    aria-label={`${label} (${unit})`} defaultValue={Math.round(value * 100) / 100} min={minimum} step="0.1" inputMode="decimal"
    onBlur={(event) => {
      const next = event.currentTarget.valueAsNumber;
      if (!Number.isFinite(next) || next < minimum || !onCommit(next)) event.currentTarget.value = String(Math.round(value * 100) / 100);
    }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /><span>{unit}</span></div></label>;
}

export function SelectionPropertiesBar({ store, onProperties }: { store: EditorStore; onProperties: () => void }) {
  const doc = useStore(store, (state) => state.document), selection = useStore(store, (state) => state.selection);
  const readOnly = useStore(store, (state) => state.readOnly), id = selection[0];
  const wall = doc.walls.find((item) => item.id === id), opening = doc.openings.find((item) => item.id === id);
  const furniture = doc.furniture.find((item) => item.id === id);
  const stair = doc.stairs?.find((item) => item.id === id);
  if (!id) return null;
  const label = wall ? 'Pared' : opening ? opening.kind === 'puerta' ? 'Puerta' : opening.kind === 'ventana' ? 'Ventana' : 'Hueco'
    : stair ? 'Escalera' : furniture ? 'Elemento' : 'Selección';
  const run = (operation: (current: EditorDocument) => EditorDocument) => {
    try { const state = store.getState(); state.apply(operation(state.document)); return true; }
    catch (error) { store.getState().setError(error instanceof Error ? error.message : 'No se pudo editar la selección.'); return false; }
  };
  return <section className={styles.propertiesBar} aria-label="Medidas de selección">
    <strong>{selection.length > 1 ? `${selection.length} elementos` : label}</strong>
    <fieldset disabled={readOnly} className={styles.propertyMeasures}>
      {wall && <>
        <MeasureField label="Curvatura" value={(wall.curveHeightMm ?? 0) / 10} minimum={-100000}
          onCommit={(n) => run((current) => setWallCurve(current, id, n * 10))} />
        <MeasureField label={wall.curveHeightMm ? 'Entre extremos' : 'Longitud'} value={distance(...wallPoints(doc, wall)) / 10} onCommit={(n) => run((current) => {
          const target = current.walls.find((item) => item.id === id)!;
          const [a, b] = wallPoints(current, target), factor = n * 10 / distance(a, b);
          return applyCommand(current, { type: 'move-vertex', vertexId: target.endVertexId,
            x: a.x + (b.x - a.x) * factor, y: a.y + (b.y - a.y) * factor });
        })} />
        <MeasureField label="Grosor" value={wall.thicknessMm / 10} onCommit={(n) => run((current) => editDocument(current,
          (next) => { next.walls.find((item) => item.id === id)!.thicknessMm = n * 10; }))} />
        <MeasureField label="Altura" value={wallConstruction(wall).heightMm / 10}
          onCommit={(n) => run((current) => setWallConstruction(current, id, { heightMm: n * 10 }))} />
      </>}
      {opening && <>
        <MeasureField label="Ancho" value={opening.widthMm / 10} onCommit={(n) => run((current) => editDocument(current,
          (next) => { const target = next.openings.find((item) => item.id === id)!;
            target.widthMm = n * 10; assertOpeningClearance(next, target); }))} />
        <MeasureField label="Altura" value={openingConstruction(opening).heightMm / 10}
          onCommit={(n) => run((current) => setOpeningConstruction(current, id, { heightMm: n * 10 }))} />
        <MeasureField label="Elevación" value={openingConstruction(opening).elevationMm / 10} minimum={0}
          onCommit={(n) => run((current) => setOpeningConstruction(current, id, { elevationMm: n * 10 }))} />
      </>}
      {stair && ([['widthMm', 'Ancho'], ['depthMm', 'Fondo'], ['heightMm', 'Altura'], ['elevationMm', 'Elevación']] as const).map(([key, text]) =>
        <MeasureField key={key} label={text} value={stair[key] / 10}
          minimum={key === 'elevationMm' ? 0 : .01}
          onCommit={(n) => run((current) => updateStair(current, id, { [key]: n * 10 }))} />)}
      {furniture && <>
        {([['widthMm', 'Ancho'], ['depthMm', 'Fondo'], ['heightMm', 'Altura'], ['elevationMm', 'Elevación']] as const).map(([key, text]) =>
          <MeasureField key={key} label={text} value={({ ...furniture, ...furnitureSpatial(furniture) })[key] / 10}
            minimum={key === 'elevationMm' ? 0 : .01} onCommit={(n) => run((current) => updateFurniture(current, id, { [key]: n * 10 }))} />)}
      </>}
      {(furniture || stair) && <MeasureField label="Ángulo" unit="°" minimum={-36000} value={(furniture ?? stair)!.rotation}
        onCommit={(rotation) => run((current) => furniture ? updateFurniture(current, id, { rotation }) : updateStair(current, id, { rotation }))} />}
    </fieldset>
    <div className={styles.propertyActions}>
      {wall && <button type="button" disabled={readOnly} onClick={() => run((d) => setWallCurve(d, id,
        wall.curveHeightMm ? 0 : defaultWallCurve(d, id)))}>{wall.curveHeightMm ? <StraightWallIcon size={20} aria-hidden="true" /> : <CurvedWallIcon size={20} aria-hidden="true" />}
        {wall.curveHeightMm ? 'Pared recta' : 'Curvar pared'}</button>}
      {(wall || opening || furniture || stair) && <>
        <button type="button" disabled={readOnly} onClick={() => store.getState().setDetailPanel('paint')}>Pintar</button>
        <button type="button" onClick={() => store.getState().setDetailPanel('comments')}>Comentarios ({doc.comments?.filter((c) => c.targetEntityId === id).length ?? 0})</button>
      </>}
      {opening && <button type="button" disabled={readOnly} onClick={() => run((current) => editDocument(current,
        (next) => { const target = next.openings.find((item) => item.id === id)!;
          target.position = .5; assertOpeningClearance(next, target); }))} title="Centrar en la pared" aria-label="Centrar en la pared">
        <AlignCenterHorizontal size={20} aria-hidden="true" /></button>}
      {wall && <button type="button" disabled={readOnly} title="Dividir pared por la mitad" aria-label="Dividir pared por la mitad"
        onClick={() => run((current) => applyCommand(current, { type: 'split-wall', wallId: id, position: .5, vertexId: newId(), newWallId: newId() }))}>
        <Scissors size={20} aria-hidden="true" /></button>}
      <button type="button" onClick={onProperties} title="Más propiedades" aria-label="Más propiedades"><SlidersHorizontal size={20} aria-hidden="true" /></button>
      <button type="button" disabled={readOnly} title="Eliminar selección" aria-label="Eliminar selección" onClick={() => {
        if (run((current) => deleteEntities(current, selection))) store.getState().select([]);
      }}><Trash2 size={20} aria-hidden="true" /></button>
      <button type="button" title="Cerrar selección" aria-label="Cerrar selección" onClick={() => store.getState().select([])}><X size={20} aria-hidden="true" /></button>
    </div>
  </section>;
}
