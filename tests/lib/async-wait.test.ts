import { describe, expect, it } from 'vitest';
import { waitUntil, withTimeout } from '@/lib/async-wait';

/** Reloj y espera simulados: el test no tarda lo que tardaría el navegador. */
function fakeClock() {
  let time = 0;
  return {
    now: () => time,
    sleep: async (ms: number) => {
      time += ms;
    },
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe('waitUntil', () => {
  it('vuelve en cuanto la condición se cumple', async () => {
    const clock = fakeClock();
    let ready = false;
    const sleep = async (ms: number) => {
      clock.advance(ms);
      if (clock.now() >= 300) ready = true;
    };
    await expect(
      waitUntil(() => ready, { timeoutMs: 20000, message: 'no', now: clock.now, sleep }),
    ).resolves.toBeUndefined();
    expect(clock.now()).toBeLessThan(500);
  });

  it('no espera nada si ya está lista', async () => {
    const clock = fakeClock();
    await waitUntil(() => true, { timeoutMs: 1, message: 'no', now: clock.now, sleep: clock.sleep });
    expect(clock.now()).toBe(0);
  });

  it('falla con un mensaje legible al agotarse el plazo', async () => {
    const clock = fakeClock();
    await expect(
      waitUntil(() => false, {
        timeoutMs: 5000,
        message: 'La vista 3D no terminó de cargar.',
        now: clock.now,
        sleep: clock.sleep,
      }),
    ).rejects.toThrow('La vista 3D no terminó de cargar.');
    // No se pasa del plazo sondeando: el último sondeo se recorta.
    expect(clock.now()).toBe(5000);
  });
});

describe('withTimeout', () => {
  it('deja pasar el resultado de una tarea puntual', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50, 'tarde')).resolves.toBe('ok');
  });

  it('propaga el error original sin esperar al plazo', async () => {
    await expect(withTimeout(Promise.reject(new Error('roto')), 50, 'tarde')).rejects.toThrow(
      'roto',
    );
  });

  it('corta una tarea que no termina nunca', async () => {
    await expect(withTimeout(new Promise(() => {}), 10, 'tarde')).rejects.toThrow('tarde');
  });
});
