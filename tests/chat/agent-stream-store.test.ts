import { describe, it, expect } from 'vitest';
import { AgentStreamStore } from '@/components/chat/agent-stream-store';

describe('AgentStreamStore — acumulación de eventos de streaming', () => {
  it('acumula los deltas de texto en orden', () => {
    const store = new AgentStreamStore();
    store.push({ type: 'text-delta', text: 'Hola ' });
    store.push({ type: 'text-delta', text: 'mundo' });
    expect(store.getSnapshot().text).toBe('Hola mundo');
  });

  it('solo registra las tool-calls marcadas como visibles', () => {
    const store = new AgentStreamStore();
    store.push({ type: 'tool-call', name: 'set_estilo', visible: true });
    store.push({ type: 'tool-call', name: 'detectInterno', visible: false });
    expect(store.getSnapshot().visibleTools).toEqual(['set_estilo']);
  });

  it('refleja la fase, el error y la finalización', () => {
    const store = new AgentStreamStore();
    store.push({ type: 'phase', phase: 'entrega' });
    store.push({ type: 'error', message: 'algo falló' });
    store.push({ type: 'done' });
    const snap = store.getSnapshot();
    expect(snap.phase).toBe('entrega');
    expect(snap.error).toBe('algo falló');
    expect(snap.done).toBe(true);
  });

  it('notifica a los suscriptores cuando cambia el snapshot', () => {
    const store = new AgentStreamStore();
    let notified = 0;
    const unsubscribe = store.subscribe(() => {
      notified += 1;
    });
    store.push({ type: 'text-delta', text: 'x' });
    expect(notified).toBe(1);
    unsubscribe();
    store.push({ type: 'text-delta', text: 'y' });
    expect(notified).toBe(1); // ya no notifica tras desuscribir
  });
});
