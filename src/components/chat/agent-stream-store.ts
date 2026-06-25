/**
 * Store externo de un turno en streaming del agente.
 *
 * Acumula los eventos del stream (`AgentStreamEvent`, F0) fuera de React y expone
 * `subscribe`/`getSnapshot` para que la UI los lea con `useSyncExternalStore`,
 * sin suscripción manual por efecto. Cada turno usa una instancia nueva.
 */
import type { AgentStreamEvent, AgentPhase } from '@/lib/contracts';

export interface StreamSnapshot {
  /** Texto acumulado de los deltas recibidos hasta ahora. */
  text: string;
  /** Nombres de las tool-calls marcadas como visibles para el usuario. */
  visibleTools: string[];
  phase: AgentPhase | null;
  done: boolean;
  error: string | null;
}

const EMPTY: StreamSnapshot = {
  text: '',
  visibleTools: [],
  phase: null,
  done: false,
  error: null,
};

export class AgentStreamStore {
  private snapshot: StreamSnapshot = EMPTY;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): StreamSnapshot => this.snapshot;

  /** Aplica un evento del stream y notifica a los suscriptores. */
  push(event: AgentStreamEvent): void {
    const prev = this.snapshot;
    switch (event.type) {
      case 'text-delta':
        this.snapshot = { ...prev, text: prev.text + event.text };
        break;
      case 'tool-call':
        this.snapshot = event.visible
          ? { ...prev, visibleTools: [...prev.visibleTools, event.name] }
          : prev;
        break;
      case 'phase':
        this.snapshot = { ...prev, phase: event.phase };
        break;
      case 'error':
        this.snapshot = { ...prev, error: event.message };
        break;
      case 'done':
        this.snapshot = { ...prev, done: true };
        break;
    }
    if (this.snapshot !== prev) this.emit();
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}
