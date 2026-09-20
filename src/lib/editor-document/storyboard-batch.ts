import type { WalkthroughPath } from './walkthrough';

/** El presupuesto y las capturas usan la misma lista, nunca un truncado silencioso. */
export function storyboardBatchPoints(route: WalkthroughPath): string[] {
  const selected = route.storyboardWaypointIds ?? [];
  if (!selected.length) throw new Error('Añade al menos una vista al recorrido.');
  if (selected.length > 8) throw new Error('Elige como máximo 8 vistas para este lote.');
  if (new Set(selected).size !== selected.length || selected.some((id) => !route.waypoints.some((point) => point.id === id))) {
    throw new Error('La selección contiene puntos que ya no existen o están repetidos.');
  }
  return [...selected];
}
