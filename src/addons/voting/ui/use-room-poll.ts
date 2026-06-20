'use client';

/**
 * Sondea el estado de una sala cada ~2s, pausando cuando la pestaña está oculta
 * (no tiene sentido refrescar lo que nadie mira, y ahorra carga en la base). Usa
 * el cursor devuelto por el servidor para pedir solo lo nuevo. El intervalo se
 * instala una vez al montar y se limpia al desmontar.
 */
import { useState } from 'react';
import { useMountEffect } from '@/lib/use-mount-effect';
import type { RoomDelta } from '../server/deltas';

const POLL_MS = 2000;

export function useRoomPoll(roomId: string) {
  const [delta, setDelta] = useState<RoomDelta | null>(null);

  useMountEffect(() => {
    let cursor: string | undefined;
    let active = true;

    const poll = async () => {
      if (document.hidden || !active) return;
      const url = `/api/voting/rooms/${roomId}${cursor ? `?since=${encodeURIComponent(cursor)}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const next = (await res.json()) as RoomDelta;
      cursor = next.cursor; // la próxima petición pide solo lo posterior
      setDelta(next);
    };

    void poll();
    const id = setInterval(() => {
      void poll();
    }, POLL_MS);

    return () => {
      active = false;
      clearInterval(id);
    };
  });

  return delta;
}
