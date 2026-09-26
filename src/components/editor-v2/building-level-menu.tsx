'use client';
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { addBuildingLevel, removeBuildingLevel, switchBuildingLevel, updateBuildingLevel } from '@/lib/editor-document/building-levels';
import { MeterField } from './property-number-field';

export function BuildingLevelMenu({ store }: { store: EditorStore }) {
  const state = useStore(store), [open, setOpen] = useState(false), [confirm, setConfirm] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const current = state.document.levels?.find((l) => l.id === state.document.activeLevelId);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (container.current?.contains(event.target as Node)) return;
      setOpen(false); setConfirm(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false); setConfirm(null);
      container.current?.querySelector('button')?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const run = (op: (doc: EditorDocument) => EditorDocument, close = true) => {
    try {
      state.apply(op(store.getState().document)); state.setTool('select'); setConfirm(null);
      if (close) setOpen(false);
    }
    catch (e) { state.setError(e instanceof Error ? e.message : 'No se pudo editar la planta'); }
  };
  return <div ref={container} style={{ position: 'relative' }}>
    <button aria-expanded={open} onClick={() => { setOpen(!open); setConfirm(null); }} aria-label="Gestionar plantas">{current?.name ?? 'Planta baja'} ▾</button>
    {open && <section aria-label="Plantas del edificio" style={{ position: 'absolute', top: '100%', right: 0, width: 300,
      maxHeight: '70vh', overflow: 'auto', background: 'white', padding: 16, boxShadow: '0 8px 32px #0003', borderRadius: 12, zIndex: 50 }}>
      <strong>Plantas</strong>
      <fieldset disabled={state.readOnly} style={{ border: 0, padding: 0, display: 'grid', gap: 10 }}>
        {(state.document.levels ?? []).map((level) => <div key={level.id} style={{ display: 'flex', gap: 6 }}>
          <button aria-pressed={level.id === current?.id} onClick={() => run((d) => switchBuildingLevel(d, level.id))}>{level.name}</button>
          <button aria-label={`Eliminar ${level.name}`} disabled={state.document.levels!.length < 2} onClick={() => setConfirm(level.id)}>Eliminar</button>
        </div>)}
        {current && <>
          <label>Nombre <input key={`${current.id}:${current.name}`} aria-label="Nombre de planta" defaultValue={current.name} maxLength={80}
            onBlur={(e) => { if (e.target.value !== current.name) run((d) => updateBuildingLevel(d, current.id, { name: e.target.value }), false); }} /></label>
          <MeterField label="Altura entre plantas" valueMm={current.heightMm} change={(heightMm) => run((d) => updateBuildingLevel(d, current.id, { heightMm }), false)} />
        </>}
        <button onClick={() => run((d) => addBuildingLevel(d))}>Nueva planta vacía</button>
        <button onClick={() => run((d) => addBuildingLevel(d, true))}>Duplicar planta actual</button>
        {confirm && <div role="alert">Se eliminará la planta y su contenido. Puedes deshacerlo.
          <button onClick={() => run((d) => removeBuildingLevel(d, confirm))}>Confirmar eliminación</button>
          <button onClick={() => setConfirm(null)}>Cancelar</button>
        </div>}
      </fieldset>
    </section>}
  </div>;
}
