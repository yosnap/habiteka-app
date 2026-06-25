'use client';

/**
 * Lee el estado de un turno en streaming del agente con `useSyncExternalStore`.
 *
 * La suscripción al store externo la gestiona React, sin `useEffect` manual: el
 * componente recibe el snapshot acumulado (texto incremental, fase, fin, error) y
 * se re-renderiza cuando llegan deltas.
 */
import { useSyncExternalStore } from 'react';
import type { AgentStreamStore, StreamSnapshot } from './agent-stream-store';

export function useAgentStream(store: AgentStreamStore): StreamSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
