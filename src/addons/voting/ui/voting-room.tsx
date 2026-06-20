'use client';

/**
 * Sala de votación: muestra el recuento en vivo (vía sondeo) y permite votar sobre
 * cada elemento. Los comentarios llegan por el mismo sondeo. El texto se muestra
 * como texto plano, nunca como HTML, para evitar inyección.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRoomPoll } from './use-room-poll';

interface Props {
  roomId: string;
  elements: Array<{ targetRef: string; label: string }>;
}

export function VotingRoom({ roomId, elements }: Props) {
  const delta = useRoomPoll(roomId);
  const [pendingRef, setPendingRef] = useState<string | null>(null);

  const totalFor = (targetRef: string) =>
    delta?.tally.find((t) => t.targetRef === targetRef)?.total ?? 0;

  const vote = async (targetRef: string, value: number) => {
    setPendingRef(targetRef);
    try {
      await fetch('/api/voting/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, targetRef, value }),
      });
    } finally {
      setPendingRef(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {elements.map((e) => (
          <li
            key={e.targetRef}
            className="border-line flex items-center justify-between rounded-[var(--radius-control)] border px-3 py-2"
          >
            <span className="text-sm">{e.label}</span>
            <span className="flex items-center gap-2">
              <strong className="text-sm tabular-nums">{totalFor(e.targetRef)}</strong>
              <Button
                size="sm"
                variant="outline"
                disabled={pendingRef === e.targetRef}
                onClick={() => vote(e.targetRef, 1)}
              >
                👍
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pendingRef === e.targetRef}
                onClick={() => vote(e.targetRef, -1)}
              >
                👎
              </Button>
            </span>
          </li>
        ))}
      </ul>
      {delta && delta.newComments.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {delta.newComments.map((c) => (
            <li key={c.id} className="text-muted-foreground">
              {c.body}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
