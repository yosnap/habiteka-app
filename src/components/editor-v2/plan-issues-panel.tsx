'use client';

/**
 * Lista de incidencias del plano bajo la tarjeta de fiabilidad: cada motivo
 * medido deja de ser un número y pasa a ser algo que se puede mirar en el plano
 * y, cuando hay arreglo seguro, reparar de una pulsación.
 *
 * Los motivos salen de `planIssues`, los mismos detectores que alimentan la
 * tarjeta, así que el texto de arriba y el de abajo nunca discrepan.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { danglingEnds, planIssues, type PlanIssueFix } from '@/lib/editor-document/plan-issues';
import {
  collapseDegenerateWalls,
  pruneOrphanFloorFinishes,
} from '@/lib/editor-document/plan-repairs';
import { planElementIndex } from '@/lib/editor-document/plan-element-index';
import { deriveRoomsSafe } from '@/lib/editor-document/rooms';

const FIX_LABELS: Record<PlanIssueFix, string> = {
  'collapse-degenerate-walls': 'Fundir los muros',
  'prune-orphan-floor-finishes': 'Limpiar los acabados',
};

interface Props {
  store: EditorStore;
  /** Lleva la vista al plano y deja seleccionados los elementos de la incidencia. */
  onLocate: (ids: string[]) => void;
  /** Se avisa tras reparar para que la tarjeta vuelva a evaluarse. */
  onRepaired: () => void;
}

export function PlanIssuesPanel({ store, onLocate, onRepaired }: Props) {
  const document = useStore(store, (state) => state.document);
  const readOnly = useStore(store, (state) => state.readOnly);
  const [error, setError] = useState<string | null>(null);
  // Qué ha cambiado la última reparación que no se ve a simple vista (huecos perdidos).
  const [notice, setNotice] = useState<string | null>(null);
  const issues = useMemo(() => planIssues(document), [document]);
  const noticeLine = notice ? <p className="text-ink mt-2" role="status">{notice}</p> : null;
  if (!issues.length) return noticeLine;

  const repair = (fix: PlanIssueFix) => {
    try {
      const state = store.getState();
      const before = state.document.openings.length;
      const next = fix === 'collapse-degenerate-walls'
        ? collapseDegenerateWalls(state.document)
        : pruneOrphanFloorFinishes(state.document);
      state.apply(next);
      // Fundir un muro puede dejar sin sitio un hueco que colgaba de él: se dice, no se calla.
      const lost = before - next.openings.length;
      setNotice(lost > 0 ? `Al fundir los muros se ${lost === 1 ? 'ha quitado 1 hueco' : `han quitado ${lost} huecos`} que no cabía${lost === 1 ? '' : 'n'} en el muro resultante. Deshaz con ⌘Z si lo necesitas.` : null);
      setError(null);
      onRepaired();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo reparar el plano.');
    }
  };

  return (
    <div className="bg-canvas rounded-card border border-line p-3 text-xs">
      <p className="text-ink font-medium">Qué falla y dónde</p>
      <p className="text-ink-soft mt-0.5">
        Lo que se repara aquí cambia el plano de la planta activa y se deshace con ⌘Z.
      </p>
      <ul className="mt-2 space-y-1.5">
        {issues.map((issue) => (
          <li key={issue.kind} className="flex flex-wrap items-center gap-2">
            <span className="text-ink-soft min-w-0 flex-1">{issue.message}</span>
            {issue.ids.length > 0 ? (
              <IssueButton onClick={() => onLocate(issue.ids)}>Ver en el plano</IssueButton>
            ) : null}
            {issue.fix && !readOnly ? (
              <IssueButton onClick={() => repair(issue.fix!)}>{FIX_LABELS[issue.fix]}</IssueButton>
            ) : null}
          </li>
        ))}
      </ul>
      {noticeLine}
      {error ? (
        <p className="text-destructive mt-2" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function IssueButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-line bg-surface text-ink shrink-0 rounded-control border px-2 py-1 hover:bg-muted"
    >
      {children}
    </button>
  );
}

/**
 * Acciones de la lista atadas al editor: localizar cierra el diálogo, vuelve al
 * 2D y selecciona (la selección se pinta en color de acento) centrando la vista
 * en el conjunto.
 */
export function usePlanIssueGate(
  store: EditorStore,
  options: { close: () => void; show2d: () => void },
): (onRepaired: () => void) => ReactNode {
  const locate = (ids: string[]) => {
    options.close();
    options.show2d();
    const state = store.getState();
    // El cambio de herramienta vacía la selección: primero la herramienta, luego los ids.
    state.setTool('select');
    state.setPan(false);
    state.select(ids);
    const index = planElementIndex(state.document, deriveRoomsSafe(state.document));
    const ends = danglingEnds(state.document).points.filter((point) => ids.includes(point.wallId));
    const points = ends.length ? ends : index.filter((entry) => ids.includes(entry.id)).map((entry) => entry.point);
    if (points.length)
      state.focusOn({
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
      });
  };
  return function renderPlanIssues(onRepaired: () => void) {
    return <PlanIssuesPanel store={store} onRepaired={onRepaired} onLocate={locate} />;
  };
}

export default PlanIssuesPanel;
