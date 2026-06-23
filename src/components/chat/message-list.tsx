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
  /** Imagen adjunta al turno (data URL), p. ej. la foto que el usuario acaba de subir. */
  imageUrl?: string;
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
        <Bubble key={t.id} role={t.role} text={t.text} imageUrl={t.imageUrl} />
      ))}
      {streamingText && <Bubble role="assistant" text={streamingText} />}
    </div>
  );
}

function Bubble({
  role,
  text,
  imageUrl,
}: {
  role: 'user' | 'assistant';
  text: string;
  imageUrl?: string;
}) {
  const isUser = role === 'user';
  return (
    <div
      className={[
        'flex max-w-[80%] flex-col gap-2 rounded-card px-3 py-2 text-sm whitespace-pre-wrap',
        isUser ? 'bg-brand-500 self-end text-white' : 'bg-surface-muted text-ink self-start',
      ].join(' ')}
    >
      {/* Vista previa de la imagen subida (la propia que el usuario eligió), para
          comprobar de un vistazo qué se envió sin abrir el explorador de archivos. */}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="Imagen del espacio subida"
          className="max-h-48 w-auto rounded-md object-contain"
        />
      ) : null}
      {text ? <span>{text}</span> : null}
    </div>
  );
}
