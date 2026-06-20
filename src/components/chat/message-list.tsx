'use client';

/**
 * Historial del chat más el texto en streaming del turno en curso. El contenido
 * se muestra como texto (no HTML crudo) para evitar inyección desde la salida del
 * modelo. Accesible como log en vivo para lectores de pantalla.
 */
export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

interface Props {
  turns: ChatTurn[];
  /** Texto del turno del asistente que se está recibiendo en streaming. */
  streamingText: string;
}

export function MessageList({ turns, streamingText }: Props) {
  return (
    <div className="flex flex-col gap-3 overflow-y-auto" role="log" aria-live="polite">
      {turns.map((t) => (
        <Bubble key={t.id} role={t.role} text={t.text} />
      ))}
      {streamingText && <Bubble role="assistant" text={streamingText} />}
    </div>
  );
}

function Bubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  const isUser = role === 'user';
  return (
    <div
      className={[
        'max-w-[80%] rounded-[var(--radius-card)] px-3 py-2 text-sm whitespace-pre-wrap',
        isUser ? 'bg-brand-500 self-end text-white' : 'bg-surface-muted text-ink self-start',
      ].join(' ')}
    >
      {text}
    </div>
  );
}
