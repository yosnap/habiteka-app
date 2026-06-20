'use client';

/**
 * Entrada de texto del chat. Envía el mensaje al agente al pulsar Enter o el
 * botón; se bloquea mientras hay un turno en curso para evitar envíos solapados.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');

  const send = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
  };

  return (
    <div className="flex items-end gap-2">
      <textarea
        className="border-line bg-surface focus-visible:ring-brand-500 min-h-10 flex-1 resize-none rounded-[var(--radius-control)] border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        rows={1}
        value={value}
        disabled={disabled}
        aria-label="Escribe tu respuesta"
        placeholder="Escribe tu respuesta…"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
      />
      <Button
        type="button"
        size="sm"
        onClick={send}
        disabled={disabled || value.trim().length === 0}
      >
        Enviar
      </Button>
    </div>
  );
}
